import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { connection, user as user_ } from '@zero/db/schema';
import { Ratelimit } from '@upstash/ratelimit';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { testImapConnection, testSmtpConnection } from '../../lib/debug-connection';

// Schema for validating IMAP/SMTP connection details
const imapSmtpConnectionSchema = z.object({
  provider: z.literal('imapAndSmtp'),
  auth: z.object({
    email: z.string().email(),
    refreshToken: z.string(),
    host: z.string(),
    port: z.string().transform((val) => parseInt(val, 10)),
    secure: z.boolean(),
    smtpHost: z.string(),
    smtpPort: z.string().transform((val) => parseInt(val, 10)),
    smtpSecure: z.boolean(),
  }),
});

// Schema for testing IMAP/SMTP connection
const testConnectionSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  imapHost: z.string(),
  imapPort: z.string().transform(val => parseInt(val, 10)),
  imapSecure: z.boolean(),
  smtpHost: z.string(),
  smtpPort: z.string().transform(val => parseInt(val, 10)),
  smtpSecure: z.boolean(),
});

export const connectionsRouter = router({
  // Test IMAP/SMTP connection without saving
  testConnection: privateProcedure
    .input(testConnectionSchema)
    .mutation(async ({ input }) => {
      const { 
        email, password, 
        imapHost, imapPort, imapSecure,
        smtpHost, smtpPort, smtpSecure 
      } = input;
      
      // Test IMAP connection
      const imapResult = await testImapConnection(imapHost, imapPort, imapSecure, email, password);
      
      // Test SMTP connection only if IMAP succeeds
      let smtpResult: { success: boolean; error?: string } = { 
        success: false, 
        error: "SMTP test skipped due to IMAP failure" 
      };
      
      if (imapResult.success) {
        smtpResult = await testSmtpConnection(smtpHost, smtpPort, smtpSecure, email, password);
      }
      
      return {
        imapTest: imapResult,
        smtpTest: smtpResult,
        success: imapResult.success && smtpResult.success
      };
    }),
  list: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ session }) => `ratelimit:get-connections-${session?.user.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { db, session } = ctx;
      const connections = await db
        .select({
          id: connection.id,
          email: connection.email,
          name: connection.name,
          picture: connection.picture,
          createdAt: connection.createdAt,
          providerId: connection.providerId,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
        })
        .from(connection)
        .where(eq(connection.userId, session.user.id));

      const disconnectedIds = connections
        .filter((c) => !c.accessToken || !c.refreshToken)
        .map((c) => c.id);

      return {
        connections: connections.map((connection) => {
          return {
            id: connection.id,
            email: connection.email,
            name: connection.name,
            picture: connection.picture,
            createdAt: connection.createdAt,
            providerId: connection.providerId,
          };
        }),
        disconnectedIds,
      };
    }),
  setDefault: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { connectionId } = input;
      const { db } = ctx;
      const user = ctx.session.user;
      const foundConnection = await db.query.connection.findFirst({
        where: and(eq(connection.id, connectionId), eq(connection.userId, user.id)),
      });
      if (!foundConnection) throw new TRPCError({ code: 'NOT_FOUND' });
      await db
        .update(user_)
        .set({ defaultConnectionId: connectionId })
        .where(eq(user_.id, user.id));
    }),
  delete: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { connectionId } = input;
      const { db } = ctx;
      const user = ctx.session.user;
      await db
        .delete(connection)
        .where(and(eq(connection.id, connectionId), eq(connection.userId, user.id)));

      if (connectionId === ctx.session.connectionId)
        await db.update(user_).set({ defaultConnectionId: null });
    }),

  // Add an IMAP/SMTP email connection with manual settings
  addImapSmtpConnection: privateProcedure
    .input(imapSmtpConnectionSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx;
      const user = ctx.session.user;

      // Extract connection details
      const { provider, auth: connectionAuth } = input;
      const { email, refreshToken, host, port, secure, smtpHost, smtpPort, smtpSecure } =
        connectionAuth;

      // Format connection metadata for storing
      const connectionId = uuidv4();
      const imapSmtpConfig = {
        provider,
        auth: {
          email,
          host,
          port,
          secure,
          smtpHost,
          smtpPort,
          smtpSecure,
        },
      };

      // Create new connection in the database
      await db.insert(connection).values({
        id: connectionId,
        userId: user.id,
        email,
        providerId: 'imapAndSmtp', // Must match the key in supportedProviders in driver/index.ts
        accessToken: '', // Not used for IMAP/SMTP
        refreshToken, // This is the password for IMAP/SMTP
        scope: JSON.stringify(imapSmtpConfig), // Store IMAP/SMTP config in the scope field
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Set a far future expiry date
        createdAt: new Date(),
        updatedAt: new Date(),
      } as typeof connection.$inferInsert);

      // If this is the user's first connection, set it as default
      const userRecord = await db.query.user.findFirst({
        where: eq(user_.id, user.id),
      });

      if (!userRecord?.defaultConnectionId) {
        await db
          .update(user_)
          .set({ defaultConnectionId: connectionId })
          .where(eq(user_.id, user.id));
      }

      return {
        success: true,
        connectionId,
      };
    }),
});
