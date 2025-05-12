import { testImapConnection, testSmtpConnection } from '../../lib/debug-connection';
import { createRateLimiterMiddleware, privateProcedure, router } from '../trpc';
import { connection, user as user_ } from '@zero/db/schema';
import { Ratelimit } from '@upstash/ratelimit';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const imapSmtpConnectionSchema = z.object({
  provider: z.literal('imapAndSmtp'),
  auth: z.object({
    email: z.string().email(),
    refreshToken: z.string(),
    host: z.string(),
    port: z.string().transform((val) => parseInt(val, 10)),
    secure: z.boolean(),
    tls: z.boolean().optional(),
    smtpHost: z.string(),
    smtpPort: z.string().transform((val) => parseInt(val, 10)),
    smtpSecure: z.boolean(),
    smtpTLS: z.boolean().optional(),
  }),
});

const testConnectionSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  imapHost: z.string(),
  imapPort: z.string().transform((val) => parseInt(val, 10)),
  imapSecure: z.boolean(),
  imapTLS: z.boolean().optional(),
  smtpHost: z.string(),
  smtpPort: z.string().transform((val) => parseInt(val, 10)),
  smtpSecure: z.boolean(),
  smtpTLS: z.boolean().optional(),
});

export const connectionsRouter = router({
  testConnection: privateProcedure.input(testConnectionSchema).mutation(async ({ input }) => {
    const [imapResult, smtpResult] = await Promise.all([
      testImapConnection(
        input.imapHost,
        input.imapPort,
        input.imapSecure,
        input.email,
        input.password,
        input.imapTLS,
      ),
      testSmtpConnection(
        input.smtpHost,
        input.smtpPort,
        input.smtpSecure,
        input.email,
        input.password,
        input.smtpTLS,
      ),
    ]);

    return {
      imapTest: imapResult,
      smtpTest: smtpResult,
      success: imapResult.success && smtpResult.success,
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

  addImapSmtpConnection: privateProcedure
    .input(imapSmtpConnectionSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx;
      const user = ctx.session.user;

      const { provider, auth: connectionAuth } = input;
      const { email, refreshToken, host, port, secure, smtpHost, smtpPort, smtpSecure } =
        connectionAuth;

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

      await db.insert(connection).values({
        id: connectionId,
        userId: user.id,
        email,
        providerId: 'imapAndSmtp',
        accessToken: '',
        refreshToken,
        scope: JSON.stringify(imapSmtpConfig),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as typeof connection.$inferInsert);

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
