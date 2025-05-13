import { deleteActiveConnection, FatalErrors, sanitizeContext, StandardizedError } from './utils';
import type { IGetThreadResponse, MailManager, ManagerConfig, ParsedDraft } from './types';
import type { Attachment, IOutgoingMessage, Label, ParsedMessage } from '../../types';
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import { simpleParser, type AddressObject } from 'mailparser';
import type { CreateDraftData } from '../schemas';
import { createMimeMessage } from 'mimetext';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { v4 as uuidv4 } from 'uuid';

type ExtendedAuthConfig = {
  accessToken: string;
  refreshToken: string;
  email: string;
  host?: string;
  port?: number;
  secure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
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
    this.config = config;

    if (!this.config.auth.accessToken) this.config.auth.accessToken = '';
    if (!this.config.auth.refreshToken) this.config.auth.refreshToken = '';

    const { host, port, secure, user, pass } = this.parseConnectionInfo(
      config as ExtendedManagerConfig,
    );

    console.log(
      `Initializing IMAP connection to ${host}:${port} (secure: ${secure}) for user ${user}`,
    );

    // Initialize IMAP client with proper options
    this.imapClient = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      logger: console,
      emitLogs: false,
      disableAutoIdle: true,
      disableAutoEnable: true,
    });

    // Initialize SMTP transport
    const { smtpHost, smtpPort, smtpSecure } = this.parseSmtpInfo(config as ExtendedManagerConfig);

    console.log(
      `Initializing SMTP connection to ${smtpHost}:${smtpPort} (secure: ${smtpSecure}) for user ${user}`,
    );

    this.smtpTransport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user,
        pass,
      },
      logger: console,
      tls: {
        rejectUnauthorized: false, // Add this for development to avoid SSL certificate issues
      },
    });
  }

  private parseConnectionInfo(config: ExtendedManagerConfig) {
    // Get host and port from config or use defaults
    const host = config.auth.host || '';
    const port = config.auth.port || 993;
    const secure = config.auth.secure !== undefined ? config.auth.secure : true;

    // For IMAP, use email as username and refreshToken as password
    const user = config.auth.email;
    const pass = config.auth.refreshToken; // Using refreshToken field as password

    return { host, port, secure, user, pass };
  }

  private parseSmtpInfo(config: ExtendedManagerConfig) {
    // Extract SMTP settings with smart defaults
    const smtpHost = config.auth.smtpHost || config.auth.host || '';
    const smtpPort = config.auth.smtpPort || this.getSmtpPort(config.auth.port || 993);
    const smtpSecure =
      config.auth.smtpSecure !== undefined
        ? config.auth.smtpSecure
        : this.getSmtpSecure(config.auth.port || 993);

    return { smtpHost, smtpPort, smtpSecure };
  }

  private getSmtpPort(imapPort: number): number {
    // Common SMTP ports based on IMAP ports
    switch (imapPort) {
      case 993:
        return 465; // Secure IMAP -> Secure SMTP
      case 143:
        return 587; // Non-secure IMAP -> TLS SMTP
      default:
        return 587; // Default to TLS port
    }
  }

  private getSmtpSecure(imapPort: number): boolean {
    // Determine if SMTP should use SSL/TLS
    return imapPort === 993;
  }

  public getScope(): string {
    // IMAP/SMTP doesn't use OAuth scopes
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
        console.log(`Connecting to IMAP server: ${host}:${port} (secure: ${secure})`);

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

  // Test method to verify connection
  public async testConnection(): Promise<{ imap: boolean; smtp: boolean }> {
    try {
      // Test IMAP connection
      await this.ensureImapConnection();
      const imapSuccess = this.imapConnected;
      // Test SMTP connection
      let smtpSuccess = false;
      try {
        await this.smtpTransport.verify();
        smtpSuccess = true;
      } catch (error) {
        console.error('SMTP verification failed:', error);
      }
      return { imap: imapSuccess, smtp: smtpSuccess };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { imap: false, smtp: false };
    }
  }

  // Folder mapping methods
  private getImapFolderPath(folder: string): string {
    // Map standard folder names to common IMAP folder paths
    const folderLower = folder.toLowerCase();
    switch (folderLower) {
      case 'inbox':
        return 'INBOX';
      case 'sent':
        return this.findFolderNameVariation(['Sent', 'Sent Items', 'Sent Mail']) || 'Sent';
      case 'drafts':
        return this.findFolderNameVariation(['Drafts', 'Draft']) || 'Drafts';
      case 'trash':
      case 'bin':
        return this.findFolderNameVariation(['Trash', 'Deleted Items', 'Deleted']) || 'Trash';
      case 'spam':
      case 'junk':
        return this.findFolderNameVariation(['Junk', 'Spam', 'Junk E-mail']) || 'Junk';
      case 'archive':
        return this.findFolderNameVariation(['Archive', 'Archived', 'All Mail']) || 'Archive';
      default:
        return folder;
    }
  }

  private async findFolderNameVariation(variations: string[]): Promise<string | null> {
    try {
      await this.ensureImapConnection();
      const mailboxes = await this.imapClient.list();

      for (const variation of variations) {
        const match = mailboxes.find(
          (box) =>
            box.name === variation || box.path === variation || box.path.endsWith(`/${variation}`),
        );

        if (match) return match.path;
      }

      return null;
    } catch (error) {
      console.error('Error finding folder variation:', error);
      return null;
    }
  }

  private async listAllFolders(): Promise<string[]> {
    await this.ensureImapConnection();

    try {
      // Get all mailboxes
      const mailboxes = await this.imapClient.list();
      // Extract folder paths
      return mailboxes.map((mailbox: { path: string }) => mailbox.path);
    } catch (error) {
      console.error('Error listing folders:', error);
      return [];
    }
  }

  private async findMessageFolder(messageId: string): Promise<string | null> {
    await this.ensureImapConnection();

    // First try common folders to optimize search
    const commonFolders = ['INBOX', 'Sent', 'Drafts', 'Archive'];
    for (const folder of commonFolders) {
      try {
        const found = await this.checkMessageInFolder(folder, messageId);
        if (found) return folder;
      } catch (error) {
        // Continue to next folder
      }
    }

    // If not found in common folders, check all folders
    const allFolders = await this.listAllFolders();

    for (const folder of allFolders) {
      if (commonFolders.includes(folder)) continue; // Skip already checked folders

      try {
        const found = await this.checkMessageInFolder(folder, messageId);
        if (found) return folder;
      } catch (error) {
        // Continue to next folder
      }
    }

    return null;
  }

  private async checkMessageInFolder(folder: string, messageId: string): Promise<boolean> {
    try {
      // Open the folder
      await this.imapClient.mailboxOpen(folder);

      // Search for the message by ID
      const results = await this.imapClient.search({
        header: ['Message-ID', `<${messageId}>`],
      });

      return results.length > 0;
    } catch (error) {
      // Return false if we can't check the folder
      return false;
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
        console.log(`Getting thread with ID: ${messageId}`);

        // Find the folder containing this message
        let folder = await this.findMessageFolder(messageId);

        if (!folder) {
          console.log(`Message with ID ${messageId} not found in any folder, trying INBOX`);
          folder = 'INBOX';
        }

        console.log(`Found message in folder: ${folder}`);

        try {
          // Select the folder
          await this.imapClient.mailboxOpen(folder);
          // First try to search by Message-ID header
          let results = await this.imapClient.search({
            header: ['Message-ID', `<${messageId}>`],
          });

          // If that doesn't work, try References or In-Reply-To headers to find related messages
          if (!results.length) {
            console.log(`No messages found with Message-ID: ${messageId}, trying References`);

            results = await this.imapClient.search({
              header: ['References', `${messageId}`],
            });

            // Try In-Reply-To as well
            if (!results.length) {
              console.log(`No messages found with References: ${messageId}, trying In-Reply-To`);

              results = await this.imapClient.search({
                header: ['In-Reply-To', `<${messageId}>`],
              });
            }
          }

          // As a last resort, try looking up by UID if it's a numeric ID
          if (!results.length) {
            try {
              console.log(`No messages found with headers, trying as UID: ${messageId}`);
              const uid = parseInt(messageId);
              if (!isNaN(uid)) {
                // Verify this UID exists
                const uidResults = await this.imapClient.search({ uid });
                if (uidResults.length > 0) {
                  results = [uid];
                }
              }
            } catch (e) {
              console.error(`Error parsing UID from ${messageId}:`, e);
            }
          }

          if (!results.length) {
            throw new Error(`Thread with ID ${messageId} not found`);
          }

          console.log(`Found ${results.length} messages for thread ID: ${messageId}`);

          // Fetch messages and parse them
          const messages = await Promise.all(
            results.map(async (uid: number) => {
              console.log(`Fetching message data for UID: ${uid}`);
              try {
                const fetchOptions = {
                  uid,
                  envelope: true,
                  bodyStructure: true,
                  source: true,
                  flags: true,
                };

                const fetchedMessage = await this.imapClient.fetchOne(uid, fetchOptions);
                if (!fetchedMessage || !fetchedMessage.source) {
                  console.error(`No message data or source returned for UID ${uid}`);
                  throw new Error(`Failed to fetch message with UID ${uid}`);
                }

                console.log(`Parsing message with UID: ${uid}`);
                const parsed = await simpleParser(fetchedMessage.source);

                return this.parseImapMessage(parsed, uid, fetchedMessage.flags || []);
              } catch (error) {
                console.error(`Error fetching message UID ${uid}:`, error);
                throw error;
              }
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
        } catch (error) {
          console.error(`Error retrieving thread ${messageId}:`, error);
          throw error;
        }
      },
      { id },
    );
  }

  public async create(data: IOutgoingMessage): Promise<{ id?: string | null }> {
    return this.withErrorHandler(
      'create',
      async () => {
        console.log('Preparing to send email');
        // Prepare mail options
        const mailOptions = await this.prepareMailOptions(data);

        try {
          // First verify SMTP connection
          console.log('Verifying SMTP connection...');
          await this.smtpTransport.verify();

          console.log('Sending email...');
          const result = await this.smtpTransport.sendMail(mailOptions);
          console.log('Email sent successfully:', result.messageId);

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

    console.log(`Preparing email to: ${to}, cc: ${cc || 'none'}, bcc: ${bcc || 'none'}`);

    // Basic email options
    const mailOptions: nodemailer.SendMailOptions = {
      from: data.fromEmail || this.config.auth.email,
      to,
      cc,
      bcc,
      subject: data.subject || '',
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

    // Add message ID if replying to a thread
    if (data.headers?.['in-reply-to']) {
      mailOptions.inReplyTo = data.headers['in-reply-to'];
    }
    if (data.headers?.['references']) {
      mailOptions.references = data.headers['references'];
    }

    // Add attachments if provided
    if (data.attachments && data.attachments.length > 0) {
      console.log(`Processing ${data.attachments.length} attachments`);
      mailOptions.attachments = await Promise.all(
        data.attachments.map(async (file) => {
          const content = await file.arrayBuffer();
          return {
            filename: file.name,
            content: Buffer.from(content),
            contentType: file.type || 'application/octet-stream',
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
          // Handle different recipient formats
          if (typeof recipient === 'object') {
            const email = recipient.email || recipient.address || '';
            const name = recipient.name || '';

            if (!email) return '';
            return name ? `"${name}" <${email}>` : email;
          }

          return '';
        })
        .filter(Boolean) // Remove empty entries
        .join(', ');
    } else if (typeof recipients === 'string') {
      // Handle string input
      return recipients;
    }
    return '';
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
        // Return cached labels if available
        if (this.userLabels.length > 0) {
          return this.userLabels;
        }

        await this.ensureImapConnection();
        console.log('Getting user labels (folders)');

        try {
          // Get all mailboxes/folders
          const mailboxes = await this.imapClient.list();
          console.log(`Found ${mailboxes.length} mailboxes`);

          // Convert IMAP folders to Labels
          this.userLabels = mailboxes.map((mailbox: any) => {
            const name = mailbox.name || mailbox.path.split('/').pop() || mailbox.path;

            // Determine if this is a system folder
            const isSystemFolder =
              !!mailbox.specialUse ||
              ['INBOX', 'Drafts', 'Sent', 'Trash', 'Junk', 'Spam'].includes(name);

            return {
              id: mailbox.path,
              name,
              type: isSystemFolder ? 'system' : 'user',
              color: {
                backgroundColor: '#E3E3E3',
                textColor: '#333333',
              },
            };
          });

          return this.userLabels;
        } catch (error) {
          console.error('Error getting user labels:', error);
          return [];
        }
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

  public async markAsRead(threadIds: string[]): Promise<void> {
    return this.withErrorHandler(
      'markAsRead',
      async () => {
        await this.ensureImapConnection();
        console.log(`Marking ${threadIds.length} threads as read`);

        for (const threadId of threadIds) {
          // Get the actual message ID (remove thread: prefix if present)
          const messageId = threadId.startsWith('thread:') ? threadId.substring(7) : threadId;
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
            // Try looking up by references
            const refResults = await this.imapClient.search({
              header: ['References', messageId],
            });
            if (refResults.length) {
              // Add found messages to results
              results.push(...refResults);
            } else {
              // Try looking up by UID
              try {
                const uid = parseInt(messageId);
                if (!isNaN(uid)) {
                  const uidResults = await this.imapClient.search({ uid });
                  if (uidResults.length) {
                    results.push(...uidResults);
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }

          if (results.length) {
            // Mark as read by adding the \Seen flag
            await this.imapClient.messageFlagsAdd(results, ['\\Seen']);
            console.log(`Marked message(s) ${results.join(', ')} as read in folder ${folder}`);
          } else {
            console.warn(
              `Message ${messageId} not found in folder ${folder}, skipping mark as read`,
            );
          }
        }
      },
      { threadIds },
    );
  }

  public async markAsUnread(threadIds: string[]): Promise<void> {
    return this.withErrorHandler(
      'markAsUnread',
      async () => {
        await this.ensureImapConnection();
        console.log(`Marking ${threadIds.length} threads as unread`);

        for (const threadId of threadIds) {
          // Get the actual message ID (remove thread: prefix if present)
          const messageId = threadId.startsWith('thread:') ? threadId.substring(7) : threadId;
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
            // Try looking up by references
            const refResults = await this.imapClient.search({
              header: ['References', messageId],
            });
            if (refResults.length) {
              // Add found messages to results
              results.push(...refResults);
            } else {
              // Try looking up by UID as last resort
              try {
                const uid = parseInt(messageId);
                if (!isNaN(uid)) {
                  const uidResults = await this.imapClient.search({ uid });
                  if (uidResults.length) {
                    results.push(...uidResults);
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }

          if (results.length) {
            // Mark as unread by removing the \Seen flag
            await this.imapClient.messageFlagsRemove(results, ['\\Seen']);
            console.log(`Marked message(s) ${results.join(', ')} as unread in folder ${folder}`);
          } else {
            console.warn(
              `Message ${messageId} not found in folder ${folder}, skipping mark as unread`,
            );
          }
        }
      },
      { threadIds },
    );
  }

  public async getAttachment(messageId: string, attachmentId: string): Promise<string | undefined> {
    return this.withErrorHandler(
      'getAttachment',
      async () => {
        await this.ensureImapConnection();
        console.log(`Getting attachment ${attachmentId} for message ${messageId}`);

        // Parse the attachmentId to extract UID and attachment identifier
        // Format: 123:filename or 123:index
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

        try {
          // Fetch the message with its structure
          const fetchedMessage = await this.imapClient.fetchOne(uid, {
            uid,
            source: true,
            bodyStructure: true,
          });

          if (!fetchedMessage || !fetchedMessage.source) {
            throw new Error(`Failed to fetch message with UID ${uid}`);
          }

          // Parse the message
          const parsed = await simpleParser(fetchedMessage.source);

          // Find the attachment by filename or index
          const attachment = parsed.attachments?.find(
            (
              att: { filename: string; contentId?: string; contentDisposition?: string },
              index: number,
            ) => {
              // Try to match by filename first
              if (att.filename === attachmentIdentifier) {
                return true;
              }
              // Try to match by content ID
              if (att.contentId && att.contentId.replace(/[<>]/g, '') === attachmentIdentifier) {
                return true;
              }
              // Try to match by index
              if (attachmentIdentifier === index.toString()) {
                return true;
              }
              return false;
            },
          );

          if (!attachment) {
            throw new Error(`Attachment ${attachmentIdentifier} not found in message ${messageId}`);
          }

          // Convert to base64
          return attachment.content?.toString('base64');
        } catch (error) {
          console.error(`Error getting attachment ${attachmentId}:`, error);
          throw error;
        }
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

  private async parseImapMessage(
    parsed: any,
    uid: number,
    flags: string[],
  ): Promise<ParsedMessage> {
    // Extract message data from the parsed email
    const headers: { [key: string]: string } = {};
    if (parsed.headerLines) {
      parsed.headerLines.forEach((header: { key: string; line: string }) => {
        headers[header.key.toLowerCase()] = header.line;
      });
    }

    // Extract email addresses
    const from = parsed.from?.value[0] || { address: '', name: '' };

    const to =
      parsed.to?.value.map((addr: AddressObject) => ({
        email: addr.address || '',
        name: addr.name || '',
      })) || [];

    const cc =
      parsed.cc?.value.map((addr: AddressObject) => ({
        email: addr.address || '',
        name: addr.name || '',
      })) || null;

    const bcc =
      parsed.bcc?.value.map((addr: AddressObject) => ({
        email: addr.address || '',
        name: addr.name || '',
      })) || [];

    // Parse attachments
    const attachments: Attachment[] = (parsed.attachments || []).map((att: any, index: number) => ({
      filename: att.filename || `attachment-${index}`,
      mimeType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      attachmentId: `${uid}:${att.filename || index}`,
      headers: Object.entries(att.headers || {}).map(([name, value]) => ({
        name,
        value: value as string,
      })),
      body: '', // Will be populated when needed
    }));

    // Determine if the message is unread based on flags
    const unread = !flags.includes('\\Seen');

    // Extract message ID (remove angle brackets if present)
    let messageId = parsed.messageId || `imap-${uuidv4()}@${this.config.auth.email.split('@')[1]}`;
    if (messageId && messageId.startsWith('<') && messageId.endsWith('>')) {
      messageId = messageId.substring(1, messageId.length - 1);
    }

    // Get HTML content with fallback to text
    const html = parsed.html || (parsed.text ? parsed.text.replace(/\n/g, '<br>') : '');
    // Extract header information
    const references = parsed.references || '';
    const inReplyTo = parsed.inReplyTo || '';
    const subject = parsed.subject || '(No subject)';
    // Create sender object
    const sender = {
      email: from.address || '',
      name: from.name || '',
    };

    // Get received date
    const receivedOn = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();

    return {
      id: messageId,
      threadId: messageId,
      title: parsed.subject || '',
      tags: [], // IMAP doesn't have tags/labels like Gmail
      tls: false, // Simplified TLS detection
      unread,
      sender,
      to,
      cc,
      bcc,
      receivedOn,
      subject,
      references,
      inReplyTo,
      messageId,
      body: parsed.text || '',
      decodedBody: html,
      processedHtml: html,
      blobUrl: '',
      attachments,
    };
  }

  public async list(params: {
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
        console.log(`Listing emails from folder: ${folderPath}`);

        try {
          // Open the mailbox
          const mailbox = await this.imapClient.mailboxOpen(folderPath);
          console.log(`Mailbox opened: ${folderPath}, total messages: ${mailbox.exists}`);

          // Handle empty mailbox
          if (mailbox.exists === 0) {
            return { threads: [], nextPageToken: null };
          }

          // Determine range to fetch
          let from = 1;
          if (pageToken && typeof pageToken === 'string') {
            from = parseInt(pageToken, 10);
            if (isNaN(from)) from = 1;
          } else if (typeof pageToken === 'number') {
            from = pageToken;
          }

          // Calculate to value respecting maxResults
          const to = Math.min(from + maxResults - 1, mailbox.exists);

          // Build search criteria
          const searchCriteria: any = {};
          if (query) {
            searchCriteria.text = query;
          }

          // Get message UIDs
          let messageIds;
          if (Object.keys(searchCriteria).length > 0) {
            // Search with criteria
            messageIds = await this.imapClient.search(searchCriteria);
            messageIds = messageIds.slice(-maxResults); // Get the latest N messages
          } else {
            // Get the most recent messages by sequence number
            const range = `${Math.max(1, mailbox.exists - to + 1)}:${mailbox.exists}`;
            console.log(`Fetching messages in range: ${range}`);
            try {
              const messages = await this.imapClient.fetch(range, { uid: true });
              messageIds = [];
              for await (const msg of messages) {
                messageIds.push(msg.uid);
              }
            } catch (error) {
              console.error(`Error fetching message range ${range}:`, error);
              messageIds = [];
            }
          }

          // Sort UIDs in descending order (newest first)
          messageIds.sort((a, b) => b - a);

          // Fetch message data for the UIDs
          const threadsMap = new Map(); // Map to track unique threads
          for (const uid of messageIds) {
            try {
              const fetchOptions = {
                uid,
                envelope: true,
                bodyStructure: true,
                flags: true,
                headers: ['message-id', 'references', 'in-reply-to'],
              };

              const fetchedMessage = await this.imapClient.fetchOne(uid, fetchOptions);
              if (!fetchedMessage) {
                console.warn(`No message data returned for UID ${uid}`);
                continue;
              }

              // Extract message ID
              const msgId = this.extractMessageId(fetchedMessage) || `imap-${uid}`;

              // Use message ID or extract thread ID from references/in-reply-to
              const threadId = this.extractThreadId(fetchedMessage) || msgId;

              // Skip duplicates in the same thread
              if (!threadsMap.has(threadId)) {
                threadsMap.set(threadId, {
                  id: threadId,
                  $raw: {
                    uid,
                    envelope: fetchedMessage.envelope,
                    flags: fetchedMessage.flags,
                  },
                });
              }
            } catch (error) {
              console.error(`Error fetching message ${uid}:`, error);
            }
          }

          // Get threads sorted by most recent messages
          const threads = Array.from(threadsMap.values());

          // Calculate next page token
          const nextPageToken = to < mailbox.exists ? `${to + 1}` : null;

          return {
            threads,
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

  private extractMessageId(message: any): string | null {
    // Extract Message-ID from headers
    const headers = message.headers || {};
    const messageId = headers['message-id'];
    if (messageId) {
      const match = messageId.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  private extractThreadId(message: any): string | null {
    // Try to extract thread ID from References or In-Reply-To headers
    const headers = message.headers || {};

    // First check message-id
    const msgId = this.extractMessageId(message);
    if (msgId) return msgId;

    // Then look for references
    const references = headers['references'];
    if (references) {
      // Get the first message ID in references chain
      const matches = references.match(/<([^>]+)>/g);
      if (matches && matches.length > 0) {
        // Extract the first reference without the angle brackets
        return matches[0].replace(/[<>]/g, '');
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
    context?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await Promise.resolve(fn());
    } catch (error: any) {
      const isFatal = FatalErrors.includes(error.message);
      // Detailed error logging
      console.error(
        `[${isFatal ? 'FATAL_ERROR' : 'ERROR'}] [IMAP/SMTP Driver] Operation: ${operation}`,
        {
          error: error.message,
          context: sanitizeContext(context),
          stack: error.stack,
          isFatal,
        },
      );
      // Close connection on fatal errors
      if (isFatal) {
        if (this.config.c) await deleteActiveConnection(this.config.c);
        await this.closeImapConnection();
      }
      throw new StandardizedError(error, operation, context);
    }
  }

  private withSyncErrorHandler<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, unknown>,
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
