import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';

export async function testImapConnection(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Testing IMAP connection to ${host}:${port} (secure: ${secure}) for user ${user}`);
    
    const imapClient = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      logger: false,
    });

    // Try to connect
    await imapClient.connect();
    console.log('IMAP connection successful!');
    
    // List mailboxes to verify connection works
    const mailboxes = await imapClient.list();
    console.log(`Found ${mailboxes.length} mailboxes`);
    
    // Close the connection
    await imapClient.logout();
    
    return { success: true };
  } catch (error) {
    console.error('IMAP connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function testSmtpConnection(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Testing SMTP connection to ${host}:${port} (secure: ${secure}) for user ${user}`);
    
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      // Set a timeout so we don't hang forever if there's a connection issue
      connectionTimeout: 10000,
    });

    // Verify connection configuration
    await transport.verify();
    console.log('SMTP connection successful!');
    
    // Close the connection
    transport.close();
    
    return { success: true };
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
