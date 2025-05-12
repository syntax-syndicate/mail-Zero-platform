import SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';

export async function testImapConnection(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string,
  useTLS?: boolean,
): Promise<{ success: boolean; error?: string }> {
  let imapClient: ImapFlow | null = null;

  try {
    console.log(
      `Testing IMAP connection to ${host}:${port} (secure: ${secure}, TLS: ${useTLS}) for user ${user}`,
    );

    require('events').defaultMaxListeners = 20;

    imapClient = new ImapFlow({
      host,
      port,
      secure, // Use the provided secure parameter
      auth: {
        user,
        pass,
      },
      logger: false, // Disable logger to reduce noise
      emitLogs: false, // Disable log emission for cleaner output
      disableAutoIdle: true,
    });

    if (!imapClient) {
      throw new Error('Failed to initialize IMAP client');
    }

    const client = imapClient;

    const connectPromise = new Promise<void>(async (resolve, reject) => {
      try {
        await client.connect();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown connection error'));
      }
    });

    try {
      // Use a much shorter timeout for just the connection attempt
      await Promise.race([
        connectPromise,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('IMAP connection timeout - Please check your credentials and try again'),
              ),
            10000, // Reduced timeout for just the initial connection
          ),
        ),
      ]);

      // If we get here, connection was successful
      console.log('IMAP connection established successfully!');

      // Skip additional operations after authentication to avoid timeouts
      return { success: true };
    } catch (error) {
      console.error('IMAP connection setup error:', error);
      throw error; // Re-throw to be caught by the outer try/catch
    }
  } catch (error) {
    console.error('IMAP connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
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
  useTLS?: boolean,
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `Testing SMTP connection to ${host}:${port} (secure: ${secure}, TLS: ${useTLS}) for user ${user}`,
  );
  let transport: nodemailer.Transporter | null = null;

  try {
    // Configure basic transport
    const transportConfig: SMTPTransport.Options = {
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      // Use shorter timeouts
      connectionTimeout: 10000,
      greetingTimeout: 7000,
      socketTimeout: 7000,
    };

    // Create transport
    transport = nodemailer.createTransport(transportConfig);

    // Verify connection with timeout
    await Promise.race([
      transport.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP connection timeout')), 15000),
      ),
    ]);

    console.log('SMTP connection verified successfully!');
    return { success: true };
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (transport) {
      transport.close();
      transport = null;
    }
  }
}
