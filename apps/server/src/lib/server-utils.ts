import { connection } from '@zero/db/schema';
import type { HonoContext } from '../ctx';
import { createDriver } from './driver';
import { and, eq } from 'drizzle-orm';

export const getActiveConnection = async (c: HonoContext) => {
  const { session, db } = c.var;
  if (!session?.user) throw new Error('Session Not Found');
  if (!session.connectionId) throw new Error('No active connection found for the user');

  const activeConnection = await db.query.connection.findFirst({
    where: and(eq(connection.userId, session.user.id), eq(connection.id, session.connectionId)),
  });

  if (!activeConnection) throw new Error('Active connection not found');

  // Different connection types have different authentication requirements
  if (activeConnection.providerId === 'imapAndSmtp') {
    // For IMAP/SMTP connections, we only need the refreshToken which contains the password
    if (!activeConnection.refreshToken) {
      throw new Error('IMAP/SMTP connection is missing password, please reconnect');
    }
  } else if (
    activeConnection.providerId === 'google' ||
    activeConnection.providerId === 'microsoft'
  ) {
    // For OAuth providers, we need both refreshToken and accessToken
    if (!activeConnection.refreshToken || !activeConnection.accessToken) {
      throw new Error(
        'OAuth connection is not properly authorized, please reconnect the connection',
      );
    }
  } else {
    // For other providers, make a general check
    if (!activeConnection.refreshToken || !activeConnection.accessToken) {
      throw new Error('Connection is not properly authorized, please reconnect the connection');
    }
  }
  return activeConnection;
};

export const connectionToDriver = (
  activeConnection: typeof connection.$inferSelect,
  c: HonoContext,
) => {
  // For IMAP/SMTP connections, we need to pass additional configuration from the scope field
  if (activeConnection.providerId === 'imapAndSmtp') {
    try {
      // Parse the IMAP/SMTP settings from the scope field
      const config = JSON.parse(activeConnection.scope);

      const driver = createDriver(activeConnection.providerId, {
        auth: {
          accessToken: activeConnection.accessToken,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          refreshToken: activeConnection.refreshToken!,
          email: activeConnection.email,
          // Pass through the IMAP/SMTP configuration
          ...config.auth,
        },
        c,
      });
      return driver;
    } catch (error) {
      console.error('Error parsing IMAP/SMTP configuration:', error);
      throw new Error('Invalid IMAP/SMTP configuration');
    }
  } else {
    // Regular OAuth connections
    const driver = createDriver(activeConnection.providerId, {
      auth: {
        accessToken: activeConnection.accessToken,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        refreshToken: activeConnection.refreshToken!,
        email: activeConnection.email,
      },
      c,
    });
    return driver;
  }
};
