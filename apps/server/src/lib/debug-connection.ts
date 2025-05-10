import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';

export async function testImapConnection(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string,
): Promise<{ success: boolean; error?: string }> {
  let imapClient: ImapFlow | null = null;

  try {
    console.log(`Testing IMAP connection to ${host}:${port} (secure: ${secure}) for user ${user}`);

    // Increase max listeners on the EventEmitter to avoid memory leak warnings
    require('events').defaultMaxListeners = 20;

    imapClient = new ImapFlow({
      host,
      port,
      secure: true, // Force SSL/TLS for port 993
      auth: {
        user,
        pass,
      },
      logger: console,
      emitLogs: true,
      disableAutoIdle: true,
    });

    if (!imapClient) {
      throw new Error('Failed to initialize IMAP client');
    }

    const client = imapClient; // Create a non-null reference

    // Try to connect with a longer timeout for initial connection
    const connectPromise = new Promise<void>(async (resolve, reject) => {
      try {
        await client.connect();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown connection error'));
      }
    });

    // Set a shorter timeout for initial connection
    await Promise.race([
      connectPromise,
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error('IMAP connection timeout - Please check your credentials and try again'),
            ),
          15000, // Reduced timeout to 15 seconds
        ),
      ),
    ]);

    console.log('IMAP connection successful!');

    // Since we successfully connected and authenticated, return success
    // We don't need to list mailboxes just to verify the connection
    return { success: true };
  } catch (error) {
    console.error('IMAP connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Always make sure to close the connection to prevent memory leaks
    if (imapClient) {
      try {
        await imapClient.logout();
      } catch (e) {
        console.error('Error closing IMAP connection:', e);
      }
      imapClient = null;
    }
  }
}

export async function testSmtpConnection(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string,
): Promise<{ success: boolean; error?: string }> {
  // Don't skip SMTP test even if IMAP fails
  console.log(`Testing SMTP connection to ${host}:${port} (secure: ${secure}) for user ${user}`);
  let transport: nodemailer.Transporter | null = null;

  try {
    console.log(`Testing SMTP connection to ${host}:${port} (secure: ${secure}) for user ${user}`);

    // Create a new transport with proper timeouts to prevent hanging connections
    transport = nodemailer.createTransport({
      host,
      port,
      secure: false, // Force STARTTLS for port 587
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: true, // Verify SSL/TLS certificates
      },
    });

    // Increase max listeners on the EventEmitter to avoid memory leak warnings
    // Using require('events') to access the EventEmitter class
    require('events').defaultMaxListeners = 20;

    // Verify connection configuration with a timeout
    await Promise.race([
      transport.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP connection timeout')), 15000),
      ),
    ]);

    console.log('SMTP connection successful!');
    return { success: true };
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Always make sure to close the transport to prevent memory leaks
    if (transport) {
      transport.close();
      transport = null;
    }
  }
}
