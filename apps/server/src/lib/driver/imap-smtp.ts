import {
  deleteActiveConnection,
  FatalErrors,
  findHtmlBody,
  fromBase64Url,
  fromBinary,
  sanitizeContext,
  StandardizedError,
} from './utils';
import type { MailManager, ManagerConfig, IGetThreadResponse, ParsedDraft } from './types';
import type { IOutgoingMessage, Label, ParsedMessage, Attachment } from '../../types';
import { parseAddressList, parseFrom, wasSentWithTLS } from '../email-utils';
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import { simpleParser, type AddressObject } from 'mailparser';
import type { CreateDraftData } from '../schemas';
import { createMimeMessage } from 'mimetext';
import { cleanSearchValue } from '../utils';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { v4 as uuidv4 } from 'uuid';
import * as he from 'he';

// Add these types to fix type errors with ManagerConfig
type ExtendedAuthConfig = {
  accessToken: string;
  refreshToken: string;
  email: string;
  host?: string;
  port?: string;
  secure?: boolean;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: boolean;
};

type ExtendedManagerConfig = {
  auth: ExtendedAuthConfig;
  c?: any;
};

export class ImapSmtpMailManager implements MailManager {
  public config: ManagerConfig;
  private imapClient: ImapFlow;
  private smtpTransport: nodemailer.Transporter;
  private standardFolders: { [key: string]: string } = {
    Inbox: 'INBOX',
    Sent: 'Sent',
    Drafts: 'Drafts',
    Trash: 'Trash',
    Junk: 'Junk',
    Archive: 'Archive',
  };
  private userLabels: Label[] = [];
  private imapConnected: boolean = false;

  constructor(config: ManagerConfig) {
    // Store the configuration
    this.config = config;

    // Initialize missing auth properties to empty strings
    if (!this.config.auth.accessToken) this.config.auth.accessToken = '';
    if (!this.config.auth.refreshToken) this.config.auth.refreshToken = '';

    const { host, port, secure, user, pass } = this.parseConnectionInfo(
      config as ExtendedManagerConfig,
    );

    // Initialize IMAP client
    this.imapClient = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      logger: false, // Set to true for debugging
    });

    // Initialize SMTP transport with separate SMTP settings if available
    const { smtpHost, smtpPort, smtpSecure } = this.parseSmtpInfo(config as ExtendedManagerConfig);

    this.smtpTransport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user,
        pass,
      },
    });
  }

  private parseConnectionInfo(config: ExtendedManagerConfig) {
    // Default to common settings if not provided
    return {
      host: config.auth.host || '',
      port: config.auth.port ? parseInt(config.auth.port) : 993,
      secure: config.auth.secure !== undefined ? config.auth.secure : true,
      user: config.auth.email,
      pass: config.auth.refreshToken, // Use the refreshToken field as password
    };
  }

  private parseSmtpInfo(config: ExtendedManagerConfig) {
    // Extract SMTP-specific settings with fallbacks
    const imapPort = config.auth.port ? parseInt(config.auth.port) : 993;

    return {
      smtpHost: config.auth.smtpHost || config.auth.host || '',
      smtpPort: config.auth.smtpPort ? parseInt(config.auth.smtpPort) : this.getSmtpPort(imapPort),
      smtpSecure:
        config.auth.smtpSecure !== undefined
          ? config.auth.smtpSecure
          : this.getSmtpSecure(imapPort),
    };
  }

  private getSmtpPort(imapPort: number): number {
    // Common SMTP ports based on IMAP ports
    switch (imapPort) {
      case 993:
        return 465; // Secure IMAP -> Secure SMTP
      case 143:
        return 587; // Non-secure IMAP -> STARTTLS SMTP
      default:
        return 587; // Default to common STARTTLS port
    }
  }

  private getSmtpSecure(imapPort: number): boolean {
    // Determine if SMTP should use SSL/TLS
    return imapPort === 993;
  }

  public getScope(): string {
    // IMAP/SMTP doesn't use OAuth scopes like Google/Microsoft
    return 'imap smtp';
  }

  // Connection management methods
  private async ensureImapConnection(): Promise<void> {
    if (!this.imapConnected) {
      try {
        // Log connection attempt
        const { host, port, secure } = this.parseConnectionInfo(
          this.config as ExtendedManagerConfig,
        );
        console.log('Attempting IMAP connection to:', host, 'port:', port, 'secure:', secure);

        await this.imapClient.connect();
        console.log('IMAP connection successful!');
        this.imapConnected = true;
      } catch (error) {
        console.error('Failed to connect to IMAP server:', error);
        throw new Error(`IMAP connection failed: ${(error as Error).message}`);
      }
    }
  }

  private async closeImapConnection(): Promise<void> {
    if (this.imapConnected) {
      try {
        await this.imapClient.logout();
        this.imapConnected = false;
      } catch (error) {
        console.error('Error closing IMAP connection:', error);
      }
    }
  }

  // Folder mapping methods
  private getImapFolderPath(folder: string): string {
    // Map standard folder names to IMAP folder paths
    switch (folder.toLowerCase()) {
      case 'inbox':
        return 'INBOX';
      case 'sent':
        return 'Sent';
      case 'drafts':
        return 'Drafts';
      case 'trash':
      case 'bin':
        return 'Trash';
      case 'spam':
      case 'junk':
        return 'Junk';
      case 'archive':
        return 'Archive';
      default:
        return folder;
    }
  }

  // Helper to generate a unique ID for messages
  private generateMessageId(messageData: any): string {
    // Try to use message ID if available, otherwise generate UUID
    return messageData.messageId?.replace(/[<>]/g, '') || `imap-${uuidv4()}`;
  }

  // Helper to generate a thread ID from message data
  private generateThreadId(messageData: any): string {
    // Use References or In-Reply-To headers to determine thread
    // This is a simplified approach; more complex threading logic would be needed for production
    const references = messageData.references || messageData.inReplyTo;
    if (references) {
      // Extract the first message ID from references as thread ID
      const match = references.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }
    // If no threading info, use message ID as thread ID
    return this.generateMessageId(messageData);
  }

  // Core MailManager interface implementation methods
  public async get(id: string): Promise<IGetThreadResponse> {
    return this.withErrorHandler(
      'get',
      async () => {
        await this.ensureImapConnection();

        // Check if we need to convert from thread: prefix
        const messageId = id.startsWith('thread:') ? id.substring(7) : id;

        // Find the folder containing this message
        const folder = await this.findMessageFolder(messageId);

        if (!folder) {
          throw new Error(`Message with ID ${messageId} not found in any folder`);
        }

        // Select the folder
        const mailbox = await this.imapClient.mailboxOpen(folder);

        // Search for the message by Message-ID header
        const results = await this.imapClient.search({
          header: ['Message-ID', `<${messageId}>`],
        });

        if (!results.length) {
          // Try looking up by UID if header search failed
          try {
            // Convert string ID to number if it's a UID
            const uid = parseInt(messageId);
            if (!isNaN(uid)) {
              results.push(uid);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        if (!results.length) {
          throw new Error(`Message with ID ${messageId} not found`);
        }

        // Fetch messages and parse them
        const messages = await Promise.all(
          results.map(async (uid: number) => {
            const fetchOptions = {
              uid,
              envelope: true,
              bodyStructure: true,
              source: true,
              flags: true,
            };

            const fetchedMessage = await this.imapClient.fetchOne(uid, fetchOptions);
            const parsed = await simpleParser(fetchedMessage.source);

            return this.parseImapMessage(parsed, uid, fetchedMessage.flags);
          }),
        );

        // Group messages by thread and sort by date
        const threadMessages = messages.sort(
          (a: ParsedMessage, b: ParsedMessage) =>
            new Date(a.receivedOn).getTime() - new Date(b.receivedOn).getTime(),
        );

        // Get labels (folders) for this thread
        const labels = await this.getUserLabels();

        return {
          messages: threadMessages,
          latest: threadMessages[threadMessages.length - 1],
          hasUnread: threadMessages.some((msg: ParsedMessage) => msg.unread),
          totalReplies: threadMessages.length,
          labels: labels.map((label: Label) => ({ id: label.id, name: label.name })),
        };
      },
      { id },
    );
  }

  public async create(data: IOutgoingMessage): Promise<{ id?: string | null }> {
    return this.withErrorHandler(
      'create',
      async () => {
        // Use nodemailer to send the email
        const mailOptions = await this.prepareMailOptions(data);

        try {
          const result = await this.smtpTransport.sendMail(mailOptions);
          return { id: result.messageId };
        } catch (error) {
          console.error('Error sending email:', error);
          throw new Error(`Failed to send email: ${(error as Error).message}`);
        }
      },
      { data },
    );
  }

  private async prepareMailOptions(data: IOutgoingMessage): Promise<nodemailer.SendMailOptions> {
    const processedHtml = await sanitizeTipTapHtml(data.message);

    // Prepare recipients
    const to = this.formatRecipients(data.to);
    const cc = data.cc ? this.formatRecipients(data.cc) : undefined;
    const bcc = data.bcc ? this.formatRecipients(data.bcc) : undefined;

    // Basic email options
    const mailOptions: nodemailer.SendMailOptions = {
      from: data.fromEmail || this.config.auth.email,
      to,
      cc,
      bcc,
      subject: data.subject,
      html: processedHtml,
      headers: {},
    };

    // Add custom headers if provided
    if (data.headers) {
      Object.entries(data.headers).forEach(([key, value]) => {
        if (value) {
          mailOptions.headers![key] = value;
        }
      });
    }

    // Add attachments if provided
    if (data.attachments && data.attachments.length > 0) {
      mailOptions.attachments = await Promise.all(
        data.attachments.map(async (file) => {
          const content = await file.arrayBuffer();
          return {
            filename: file.name,
            content: Buffer.from(content),
            contentType: file.type,
          };
        }),
      );
    }

    return mailOptions;
  }

  private formatRecipients(recipients: any): string {
    if (Array.isArray(recipients)) {
      // Handle array of recipient objects
      return recipients
        .map((recipient) => {
          if (typeof recipient === 'string') return recipient;
          const name = recipient.name ? `"${recipient.name}"` : '';
          const email = recipient.email;
          return name ? `${name} <${email}>` : email;
        })
        .join(', ');
    } else {
      // Handle string input
      return recipients;
    }
  }

  public async delete(id: string): Promise<void> {
    return this.withErrorHandler(
      'delete',
      async () => {
        await this.ensureImapConnection();

        // Find the folder containing this message
        const folder = await this.findMessageFolder(id);

        if (!folder) {
          throw new Error(`Message with ID ${id} not found in any folder`);
        }

        // Open the folder
        await this.imapClient.mailboxOpen(folder);

        // Search for the message by ID
        const results = await this.imapClient.search({
          header: ['Message-ID', `<${id}>`],
        });

        if (!results.length) {
          // Try looking up by UID if it's a numeric ID
          try {
            const uid = parseInt(id);
            if (!isNaN(uid)) {
              results.push(uid);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        if (!results.length) {
          throw new Error(`Message with ID ${id} not found`);
        }

        // Move to trash or mark as deleted
        try {
          // First try to move to trash folder
          const trashFolder = await this.findFolder('Trash');

          if (trashFolder) {
            // Move to trash if trash folder exists
            await this.imapClient.messageMove(results, trashFolder);
          } else {
            // Otherwise flag as deleted
            await this.imapClient.messageFlagsAdd(results, ['\\Deleted']);
            // Expunge to remove the messages marked for deletion
            await this.imapClient.mailboxExpunge();
          }
        } catch (error) {
          console.error('Error deleting message:', error);
          throw error;
        }
      },
      { id },
    );
  }

  private async findFolder(folderName: string): Promise<string | null> {
    const mailboxes = await this.imapClient.list();

    // Common folder name variations
    const variations = [
      folderName,
      folderName.toLowerCase(),
      folderName.toUpperCase(),
      folderName.charAt(0).toUpperCase() + folderName.slice(1).toLowerCase(),
    ];

    for (const mailbox of mailboxes) {
      const path = mailbox.path;
      const name = path.split('/').pop() || path;

      if (variations.includes(name)) {
        return path;
      }
    }

    return null;
  }

  public normalizeIds(ids: string[]): { threadIds: string[] } {
    return this.withSyncErrorHandler(
      'normalizeIds',
      () => {
        const threadIds: string[] = ids.map((id) =>
          id.startsWith('thread:') ? id.substring(7) : id,
        );
        return { threadIds };
      },
      { ids },
    );
  }

  public async getUserLabels(): Promise<Label[]> {
    return this.withErrorHandler(
      'getUserLabels',
      async () => {
        if (this.userLabels.length > 0) {
          return this.userLabels;
        }

        await this.ensureImapConnection();

        // Get all mailboxes/folders
        const mailboxes = await this.imapClient.list();

        // Convert IMAP folders to Labels
        this.userLabels = mailboxes.map((mailbox: any) => {
          const path = mailbox.path;
          const name = path.split('/').pop() || path;

          return {
            id: path,
            name,
            type: mailbox.specialUse ? 'system' : 'user',
            color: {
              backgroundColor: '#E3E3E3',
              textColor: '#333333',
            },
          };
        });

        return this.userLabels;
      },
      { email: this.config.auth?.email },
    );
  }

  public async getLabel(labelId: string): Promise<Label> {
    return this.withErrorHandler(
      'getLabel',
      async () => {
        await this.ensureImapConnection();

        // If we already have the label in cache, return it
        const cachedLabel = this.userLabels.find((label) => label.id === labelId);
        if (cachedLabel) return cachedLabel;

        // Otherwise fetch all labels and look for it
        const labels = await this.getUserLabels();
        const label = labels.find((label) => label.id === labelId);

        if (!label) {
          throw new Error(`Label with ID ${labelId} not found`);
        }

        return label;
      },
      { labelId },
    );
  }

  public async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }): Promise<void> {
    return this.withErrorHandler(
      'createLabel',
      async () => {
        await this.ensureImapConnection();

        try {
          // Create the folder via IMAP
          await this.imapClient.mailboxCreate(label.name);

          // Refresh the labels cache
          this.userLabels = [];
          await this.getUserLabels();
        } catch (error) {
          console.error(`Error creating folder ${label.name}:`, error);
          throw new Error(`Failed to create folder: ${(error as Error).message}`);
        }
      },
      { label },
    );
  }

  public async updateLabel(id: string, label: Label): Promise<void> {
    return this.withErrorHandler(
      'updateLabel',
      async () => {
        await this.ensureImapConnection();

        try {
          // Get the existing label
          const existingLabel = await this.getLabel(id);

          // For IMAP, we can only rename folders, not change colors
          if (existingLabel.name !== label.name) {
            await this.imapClient.mailboxRename(id, label.name);
          }

          // Refresh the labels cache
          this.userLabels = [];
          await this.getUserLabels();
        } catch (error) {
          console.error(`Error updating folder ${id}:`, error);
          throw new Error(`Failed to update folder: ${(error as Error).message}`);
        }
      },
      { id, label },
    );
  }

  public async deleteLabel(id: string): Promise<void> {
    return this.withErrorHandler(
      'deleteLabel',
      async () => {
        await this.ensureImapConnection();

        try {
          // Delete the folder via IMAP
          await this.imapClient.mailboxDelete(id);

          // Refresh the labels cache
          this.userLabels = [];
          await this.getUserLabels();
        } catch (error) {
          console.error(`Error deleting folder ${id}:`, error);
          throw new Error(`Failed to delete folder: ${(error as Error).message}`);
        }
      },
      { id },
    );
  }

  public async modifyLabels(
    messageIds: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ): Promise<void> {
    return this.withErrorHandler(
      'modifyLabels',
      async () => {
        await this.ensureImapConnection();

        // Process each message ID
        for (const messageId of messageIds) {
          // Find the message in its current folder
          const sourceFolder = await this.findMessageFolder(messageId);

          if (!sourceFolder) {
            console.warn(
              `Message ${messageId} not found in any folder, skipping label modification`,
            );
            continue;
          }

          // Open the source folder
          await this.imapClient.mailboxOpen(sourceFolder);

          // Search for the message by ID
          const results = await this.imapClient.search({
            header: ['Message-ID', `<${messageId}>`],
          });

          if (!results.length) {
            // Try looking up by UID if it's a numeric ID
            try {
              const uid = parseInt(messageId);
              if (!isNaN(uid)) {
                results.push(uid);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          if (!results.length) {
            console.warn(
              `Message ${messageId} not found in folder ${sourceFolder}, skipping label modification`,
            );
            continue;
          }

          // Handle adding labels - in IMAP this means moving to a folder
          if (options.addLabels && options.addLabels.length > 0) {
            // In IMAP we can only move a message to one folder at a time
            // So we use the first label as the destination
            const targetFolderId = options.addLabels[0];

            // If we're trying to move to the same folder, skip
            if (targetFolderId === sourceFolder) continue;

            // Move the message to the target folder
            await this.imapClient.messageMove(results, targetFolderId);
          }

          // Handle removing labels
          // In IMAP there's no direct equivalent of removing a label without adding another
          // To simulate removing a label, we would need to move to another folder
        }
      },
      { messageIds, options },
    );
  }

  // Draft operations
  public async createDraft(
    data: CreateDraftData,
  ): Promise<{ id?: string | null; success?: boolean; error?: string }> {
    return this.withErrorHandler(
      'createDraft',
      async () => {
        await this.ensureImapConnection();

        try {
          // First, find the Drafts folder
          const draftsFolder = await this.findFolder('Drafts');

          if (!draftsFolder) {
            throw new Error('Drafts folder not found');
          }

          // Create MIME message
          const msg = createMimeMessage();
          msg.setSender(this.config.auth.email);

          // Add recipients
          if (data.to) {
            const toAddresses = data.to.split(',').map((addr) => ({ addr: addr.trim() }));
            msg.setTo(toAddresses);
          }

          if (data.cc) {
            const ccAddresses = data.cc.split(',').map((addr) => ({ addr: addr.trim() }));
            msg.setCc(ccAddresses);
          }

          if (data.bcc) {
            const bccAddresses = data.bcc.split(',').map((addr) => ({ addr: addr.trim() }));
            msg.setBcc(bccAddresses);
          }

          // Set subject and content
          msg.setSubject(data.subject || '');
          msg.addMessage({
            contentType: 'text/html',
            data: await sanitizeTipTapHtml(data.message || ''),
          });

          // Add attachments if present
          if (data.attachments && data.attachments.length > 0) {
            for (const attachment of data.attachments) {
              const arrayBuffer = await attachment.arrayBuffer();
              const base64Data = Buffer.from(arrayBuffer).toString('base64');
              msg.addAttachment({
                filename: attachment.name,
                contentType: attachment.type,
                data: base64Data,
              });
            }
          }

          // Generate the raw email
          const rawEmail = msg.asRaw();

          // Open drafts folder
          await this.imapClient.mailboxOpen(draftsFolder);

          // If updating existing draft
          if (data.id) {
            // First, find and delete the existing draft
            const results = await this.imapClient.search({
              header: ['Message-ID', `<${data.id}>`],
            });

            if (results.length > 0) {
              // Mark the existing draft for deletion
              await this.imapClient.messageFlagsAdd(results, ['\\Deleted']);
              await this.imapClient.mailboxExpunge();
            }
          }

          // Append the new draft to the Drafts folder
          const appendResult = await this.imapClient.append(draftsFolder, rawEmail, ['\\Draft']);

          // Extract the message ID from the rawEmail
          const messageIdMatch = rawEmail.match(/Message-ID:\s*<([^>]+)>/i);
          const messageId = messageIdMatch ? messageIdMatch[1] : `draft-${uuidv4()}`;

          return {
            id: messageId,
            success: true,
          };
        } catch (error) {
          console.error('Error creating draft:', error);
          return {
            success: false,
            error: `Failed to create draft: ${(error as Error).message}`,
          };
        }
      },
      { data },
    );
  }

  public async getDraft(draftId: string): Promise<ParsedDraft> {
    return this.withErrorHandler(
      'getDraft',
      async () => {
        await this.ensureImapConnection();

        // Find the Drafts folder
        const draftsFolder = await this.findFolder('Drafts');

        if (!draftsFolder) {
          throw new Error('Drafts folder not found');
        }

        // Open the drafts folder
        await this.imapClient.mailboxOpen(draftsFolder);

        // Search for the draft by ID
        const results = await this.imapClient.search({
          header: ['Message-ID', `<${draftId}>`],
        });

        if (!results.length) {
          throw new Error(`Draft with ID ${draftId} not found`);
        }

        // Fetch the draft message
        const uid = results[0];
        const fetchOptions = {
          uid,
          source: true,
        };

        const fetchedMessage = await this.imapClient.fetchOne(uid, fetchOptions);
        const parsed = await simpleParser(fetchedMessage.source);

        // Extract information for ParsedDraft
        const to =
          parsed.to?.value?.map(
            (addr: { address?: string; value: string }) => addr.address || addr.value,
          ) || [];
        const subject = parsed.subject || '';
        const content = parsed.html || parsed.text?.replace(/\n/g, '<br>') || '';

        return {
          id: draftId,
          to,
          subject,
          content,
          rawMessage: parsed,
        };
      },
      { draftId },
    );
  }

  public async listDrafts(params: {
    q?: string;
    maxResults?: number;
    pageToken?: string | number;
  }): Promise<{ threads: { id: string; $raw: unknown }[]; nextPageToken: string | null }> {
    return this.withErrorHandler(
      'listDrafts',
      async () => {
        const { q, maxResults = 20, pageToken } = params;
        await this.ensureImapConnection();

        // Find the Drafts folder
        const draftsFolder = await this.findFolder('Drafts');

        if (!draftsFolder) {
          throw new Error('Drafts folder not found');
        }

        // Open the drafts folder
        const mailbox = await this.imapClient.mailboxOpen(draftsFolder);

        // Determine range to fetch
        let from = 1;
        if (pageToken && typeof pageToken === 'string') {
          from = parseInt(pageToken, 10);
          if (isNaN(from)) from = 1;
        } else if (typeof pageToken === 'number') {
          from = pageToken;
        }

        // Calculate to value respecting maxResults
        let to = Math.min(from + maxResults - 1, mailbox.exists);

        // Search criteria
        let searchCriteria: any = {};

        if (q) {
          searchCriteria.text = q;
        }

        // Get the message UIDs
        let uids;

        if (Object.keys(searchCriteria).length > 0) {
          uids = await this.imapClient.search(searchCriteria);
          uids = uids.slice(0, maxResults);
        } else {
          // Get the most recent messages first
          const range = `${mailbox.exists - to + 1}:${mailbox.exists - from + 1}`;
          const messages = await this.imapClient.fetch(range, { uid: true });
          uids = [];
          for (const msg of messages) {
            uids.push(msg.uid);
          }
        }

        // Fetch message data
        const drafts = [];

        for (const uid of uids) {
          try {
            const fetchOptions = {
              uid,
              envelope: true,
              bodyStructure: true,
              headers: ['message-id', 'subject', 'from', 'to', 'cc', 'bcc', 'date'],
            };

            const fetchedMessage = await this.imapClient.fetchOne(uid, fetchOptions);
            const messageId = fetchedMessage.headers?.['message-id'] || `draft-${uid}`;

            drafts.push({
              id: messageId.replace(/[<>]/g, ''),
              $raw: fetchedMessage,
            });
          } catch (error) {
            console.error(`Error fetching draft ${uid}:`, error);
          }
        }

        // Calculate next page token
        const nextPageToken = to < mailbox.exists ? `${to + 1}` : null;

        return {
          threads: drafts,
          nextPageToken,
        };
      },
      { ...params },
    );
  }

  public async sendDraft(draftId: string, data: IOutgoingMessage): Promise<void> {
    return this.withErrorHandler(
      'sendDraft',
      async () => {
        await this.ensureImapConnection();

        // First get the draft
        const draft = await this.getDraft(draftId);

        // Merge the draft data with any updates in the data parameter
        const mailOptions = await this.prepareMailOptions({
          ...data,
          to: data.to || (draft.to ? draft.to.map((email) => ({ email, name: '' })) : []),
          subject: data.subject || draft.subject || '',
          message: data.message || draft.content || '',
        });

        try {
          // Send the email
          await this.smtpTransport.sendMail(mailOptions);

          // Delete the draft after sending
          // Find the Drafts folder
          const draftsFolder = await this.findFolder('Drafts');

          if (draftsFolder) {
            // Open the drafts folder
            await this.imapClient.mailboxOpen(draftsFolder);

            // Search for the draft by ID
            const results = await this.imapClient.search({
              header: ['Message-ID', `<${draftId}>`],
            });

            if (results.length > 0) {
              // Delete the draft
              await this.imapClient.messageFlagsAdd(results, ['\\Deleted']);
              await this.imapClient.mailboxExpunge();
            }
          }
        } catch (error) {
          console.error('Error sending draft:', error);
          throw new Error(`Failed to send draft: ${(error as Error).message}`);
        }
      },
      { draftId, data },
    );
  }

  public async markAsRead(messageIds: string[]): Promise<void> {
    return this.withErrorHandler(
      'markAsRead',
      async () => {
        await this.ensureImapConnection();

        for (const messageId of messageIds) {
          // Find the folder containing this message
          const folder = await this.findMessageFolder(messageId);

          if (!folder) {
            console.warn(`Message ${messageId} not found in any folder, skipping mark as read`);
            continue;
          }

          // Open the folder
          await this.imapClient.mailboxOpen(folder);

          // Search for the message by ID
          const results = await this.imapClient.search({
            header: ['Message-ID', `<${messageId}>`],
          });

          if (!results.length) {
            // Try looking up by UID
            try {
              const uid = parseInt(messageId);
              if (!isNaN(uid)) {
                results.push(uid);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          if (results.length) {
            // Mark as read by adding the \Seen flag
            await this.imapClient.messageFlagsAdd(results, ['\\Seen']);
          } else {
            console.warn(
              `Message ${messageId} not found in folder ${folder}, skipping mark as read`,
            );
          }
        }
      },
      { messageIds },
    );
  }

  public async markAsUnread(messageIds: string[]): Promise<void> {
    return this.withErrorHandler(
      'markAsUnread',
      async () => {
        await this.ensureImapConnection();

        for (const messageId of messageIds) {
          // Find the folder containing this message
          const folder = await this.findMessageFolder(messageId);

          if (!folder) {
            console.warn(`Message ${messageId} not found in any folder, skipping mark as unread`);
            continue;
          }

          // Open the folder
          await this.imapClient.mailboxOpen(folder);

          // Search for the message by ID
          const results = await this.imapClient.search({
            header: ['Message-ID', `<${messageId}>`],
          });

          if (!results.length) {
            // Try looking up by UID
            try {
              const uid = parseInt(messageId);
              if (!isNaN(uid)) {
                results.push(uid);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          if (results.length) {
            // Mark as unread by removing the \Seen flag
            await this.imapClient.messageFlagsRemove(results, ['\\Seen']);
          } else {
            console.warn(
              `Message ${messageId} not found in folder ${folder}, skipping mark as unread`,
            );
          }
        }
      },
      { messageIds },
    );
  }

  public async getAttachment(messageId: string, attachmentId: string): Promise<string | undefined> {
    return this.withErrorHandler(
      'getAttachment',
      async () => {
        await this.ensureImapConnection();

        // Parse the attachmentId to extract UID and attachment identifier
        // Format: 123:filename or 123:contentId
        const parts = attachmentId.split(':');

        if (parts.length !== 2) {
          throw new Error(`Invalid attachment ID format: ${attachmentId}`);
        }

        const uid = parseInt(parts[0]);
        const attachmentIdentifier = parts[1];

        if (isNaN(uid)) {
          throw new Error(`Invalid UID in attachment ID: ${attachmentId}`);
        }

        // Find the folder containing this message
        const folder = await this.findMessageFolder(messageId);

        if (!folder) {
          throw new Error(`Message with ID ${messageId} not found in any folder`);
        }

        // Open the folder
        await this.imapClient.mailboxOpen(folder);

        // Fetch the message with its structure
        const fetchedMessage = await this.imapClient.fetchOne(uid, {
          uid,
          source: true,
          bodyStructure: true,
        });

        // Parse the message
        const parsed = await simpleParser(fetchedMessage.source);

        // Find the attachment
        const attachment = parsed.attachments?.find(
          (att: { filename: string; contentId?: string; content: Buffer }) => {
            return (
              att.filename === attachmentIdentifier ||
              (att.contentId && att.contentId.replace(/[<>]/g, '') === attachmentIdentifier)
            );
          },
        );

        if (!attachment) {
          throw new Error(`Attachment ${attachmentIdentifier} not found in message ${messageId}`);
        }

        // Convert to base64
        return attachment.content?.toString('base64');
      },
      { messageId, attachmentId },
    );
  }

  public async getEmailAliases(): Promise<{ email: string; name?: string; primary?: boolean }[]> {
    return this.withErrorHandler(
      'getEmailAliases',
      async () => {
        // For IMAP/SMTP, we don't have a direct way to get aliases
        // Return the primary email from the config
        return [{ email: this.config.auth.email, primary: true }];
      },
      {},
    );
  }

  public async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    return this.withErrorHandler(
      'revokeRefreshToken',
      async () => {
        // For IMAP/SMTP, there's no concept of revoking a refresh token
        // since we use direct password authentication
        // We'll just return true to indicate success
        console.log('Refresh token revocation not applicable for IMAP/SMTP');
        return true;
      },
      { refreshToken },
    );
  }

  private async listAllFolders(): Promise<string[]> {
    await this.ensureImapConnection();

    // Get all mailboxes
    const mailboxes = await this.imapClient.list();

    // Extract folder paths
    return mailboxes.map((mailbox: { path: string }) => mailbox.path);
  }

  private async findMessageFolder(messageId: string): Promise<string | null> {
    await this.ensureImapConnection();

    // Get all possible folders
    const folders = await this.listAllFolders();

    // Check each folder for the message ID
    for (const folder of folders) {
      try {
        // Open the folder
        await this.imapClient.mailboxOpen(folder);

        // Search for the message by ID
        const results = await this.imapClient.search({
          header: ['Message-ID', `<${messageId}>`],
        });

        if (results.length > 0) {
          return folder;
        }

        // Try looking up by UID
        try {
          const uid = parseInt(messageId);
          if (!isNaN(uid)) {
            // Check if this UID exists in the folder
            const exists = await this.imapClient.search({ uid });
            if (exists.length > 0) {
              return folder;
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      } catch (error) {
        console.warn(`Error searching folder ${folder}:`, error);
        // Continue to the next folder
      }
    }

    return null;
  }

  private async parseImapMessage(parsed: any, uid: number, flags: string[]): Promise<any> {
    // Extract headers
    const headers: { [key: string]: string } = {};
    parsed.headerLines.forEach((header: { key: string; line: string }) => {
      headers[header.key.toLowerCase()] = header.line;
    });

    // Extract email addresses
    const from = parsed.from?.value[0] || { address: '', name: '' };
    const to =
      parsed.to?.value.map((addr: { address: string; name: string }) => addr.address) || [];
    const cc =
      parsed.cc?.value.map((addr: { address: string; name: string }) => addr.address) || [];
    const bcc =
      parsed.bcc?.value.map((addr: { address: string; name: string }) => addr.address) || [];

    // Parse attachments
    const attachments: Attachment[] = (parsed.attachments || []).map((att: any, index: number) => ({
      filename: att.filename || `attachment-${index}`,
      mimeType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      attachmentId: `${uid}:${att.filename || index}`,
      headers: [],
    }));

    // Determine if the message is unread
    const unread = !flags.includes('\\Seen');

    // Get message ID (remove angle brackets if present)
    let messageId = parsed.messageId || `<${uuidv4()}@${this.config.auth.email.split('@')[1]}>`;
    if (messageId && messageId.startsWith('<') && messageId.endsWith('>')) {
      messageId = messageId.substring(1, messageId.length - 1);
    }

    // Create the parsed message object with the correct properties
    // For the implementation to work, we'll cast this to any to avoid TypeScript errors,
    // while ensuring we maintain the shape required by the application
    return {
      id: messageId,
      subject: parsed.subject || '',
      threadId: messageId,
      title: parsed.subject || '', // Required by ParsedMessage
      tags: [], // Required by ParsedMessage
      sender: { email: from.address, name: from.name }, // Required by ParsedMessage
      tls: false, // Required by ParsedMessage
      from: { email: from.address, name: from.name },
      to,
      cc,
      bcc,
      internalDate: parsed.date?.getTime() || Date.now(),
      receivedOn: new Date(parsed.date || Date.now()).toISOString(),
      body: parsed.text || '',
      content: parsed.html || parsed.text || '',
      html: parsed.html || '',
      attachments,
      size: parsed.size || 0,
      unread,
      headers,
      inReplyTo: parsed.inReplyTo || null,
      references: parsed.references || [],
      raw: parsed,
      uid,
    };
  }

  public list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string | number;
  }): Promise<{ threads: { id: string; $raw?: unknown }[]; nextPageToken: string | null }> {
    return this.withErrorHandler(
      'list',
      async () => {
        const { folder, query, maxResults = 100, pageToken } = params;
        await this.ensureImapConnection();

        // Map folder name to IMAP path
        const folderPath = this.getImapFolderPath(folder);

        try {
          // Open the mailbox
          const mailbox = await this.imapClient.mailboxOpen(folderPath);

          // Determine range to fetch
          let from = 1;
          if (pageToken && typeof pageToken === 'string') {
            from = parseInt(pageToken, 10);
            if (isNaN(from)) from = 1;
          } else if (typeof pageToken === 'number') {
            from = pageToken;
          }

          // Calculate to value respecting maxResults
          let to = Math.min(from + maxResults - 1, mailbox.exists);

          // Build search criteria
          let searchCriteria: any = {};

          if (query) {
            // Add text search if query provided
            searchCriteria.text = query;
          }

          // Search for messages
          let uids;

          if (Object.keys(searchCriteria).length > 0) {
            uids = await this.imapClient.search(searchCriteria);

            // Sort UIDs in descending order (newest first)
            uids.sort((a, b) => b - a);

            // Apply pagination
            uids = uids.slice(from - 1, from - 1 + maxResults);
          } else {
            // If no search criteria, get messages by sequence
            // Convert to array of UIDs
            const range = `${mailbox.exists - to + 1}:${mailbox.exists - from + 1}`;
            const seqMessages = await this.imapClient.fetch(range, { uid: true });
            uids = [];
            for (const msg of seqMessages) {
              uids.push(msg.uid);
            }
            // Sort UIDs in descending order
            uids.sort((a, b) => b - a);
          }

          // Fetch message data for the UIDs
          const messages = [];

          for (const uid of uids) {
            try {
              const fetchOptions = {
                uid,
                envelope: true,
                bodyStructure: true,
                flags: true,
                headers: ['message-id', 'references', 'in-reply-to'],
              };

              const fetchedMessage = await this.imapClient.fetchOne(uid, fetchOptions);

              // Group by thread using References/In-Reply-To headers
              const threadId = this.extractThreadId(fetchedMessage);

              messages.push({
                id: threadId || `${uid}`,
                $raw: {
                  uid,
                  envelope: fetchedMessage.envelope,
                  flags: fetchedMessage.flags,
                },
              });
            } catch (error) {
              console.error(`Error fetching message ${uid}:`, error);
            }
          }

          // Calculate next page token
          const nextPageToken = to < mailbox.exists ? `${to + 1}` : null;

          return {
            threads: messages,
            nextPageToken,
          };
        } catch (error) {
          console.error(`Error listing messages from folder ${folderPath}:`, error);
          throw error;
        }
      },
      { ...params },
    );
  }

  private extractThreadId(message: any): string | null {
    // Try to extract thread ID from References or In-Reply-To headers
    const headers = message.headers || {};

    // First check message-id
    const messageId = headers['message-id'];
    if (messageId) {
      const match = messageId.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Then look for references
    const references = headers['references'];
    if (references) {
      const match = references.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Finally try in-reply-to
    const inReplyTo = headers['in-reply-to'];
    if (inReplyTo) {
      const match = inReplyTo.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  public async getUserInfo(): Promise<{ address: string; name: string; photo: string }> {
    return this.withErrorHandler(
      'getUserInfo',
      async () => {
        await this.ensureImapConnection();

        // For IMAP/SMTP, we don't have a direct way to get user info
        // So we'll return the email address from the config
        return {
          address: this.config.auth.email,
          name: '', // No way to get name via IMAP
          photo: '', // No way to get photo via IMAP
        };
      },
      {},
    );
  }

  public async getTokens(
    code: string,
  ): Promise<{ tokens: { access_token?: string; refresh_token?: string; expiry_date?: number } }> {
    return this.withErrorHandler<{
      tokens: { access_token?: string; refresh_token?: string; expiry_date?: number };
    }>(
      'getTokens',
      async () => {
        // IMAP doesn't use OAuth tokens typically, but we'll return a shaped object for consistency
        return {
          tokens: {
            // For IMAP/SMTP, access token isn't relevant, but we maintain interface compatibility
            access_token: this.config.auth.accessToken || '',
            // We don't have a refresh token concept in IMAP/SMTP
            refresh_token: this.config.auth.refreshToken || '',
            // Set an expiry date far in the future (1 year from now)
            expiry_date: Date.now() + 365 * 24 * 60 * 60 * 1000,
          },
        };
      },
      { code },
    );
  }

  public async count(): Promise<{ count?: number; label?: string }[]> {
    return this.withErrorHandler(
      'count',
      async () => {
        await this.ensureImapConnection();

        // Get all mailboxes
        const mailboxes = await this.imapClient.list();

        // Result array for folder counts
        const counts = [];

        for (const mailbox of mailboxes) {
          try {
            const status = await this.imapClient.status(mailbox.path, {
              messages: true,
              unseen: true,
            });

            counts.push({
              label: mailbox.path,
              count: status.unseen || 0,
            });
          } catch (error) {
            console.error(`Error getting count for folder ${mailbox.path}:`, error);
          }
        }

        return counts;
      },
      { email: this.config.auth?.email },
    );
  }

  // Error handling methods
  private async withErrorHandler<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context?: Record<string, any>,
  ): Promise<T> {
    try {
      return await Promise.resolve(fn());
    } catch (error: any) {
      const isFatal = FatalErrors.includes(error.message);

      console.error(
        `[${isFatal ? 'FATAL_ERROR' : 'ERROR'}] [IMAP/SMTP Driver] Operation: ${operation}`,
        {
          error: error.message,
          context: sanitizeContext(context),
          stack: error.stack,
          isFatal,
        },
      );

      if (isFatal && this.config.c) await deleteActiveConnection(this.config.c);
      throw new StandardizedError(error, operation, context);
    }
  }

  private withSyncErrorHandler<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, any>,
  ): T {
    try {
      return fn();
    } catch (error: any) {
      const isFatal = FatalErrors.includes(error.message);

      console.error(`[IMAP/SMTP Driver Error] Operation: ${operation}`, {
        error: error.message,
        context: sanitizeContext(context),
        stack: error.stack,
        isFatal,
      });

      if (isFatal && this.config.c) void deleteActiveConnection(this.config.c);
      throw new StandardizedError(error, operation, context);
    }
  }
}
