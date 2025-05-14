import { authProviders, customProviders, isProviderEnabled } from '@zero/server/auth-providers';
import { LoginClient } from './login-client';
import { useLoaderData } from 'react-router';

export function loader() {
  const envNodeEnv = process.env.NODE_ENV;
  const isProd = envNodeEnv === 'production';

  const authProviderStatus = authProviders(process.env as Record<string, string>).map(
    (provider) => {
      const envVarStatus =
        provider.envVarInfo?.map((envVar) => ({
          name: envVar.name,
          set: !!process.env[envVar.name],
          source: envVar.source,
          defaultValue: envVar.defaultValue,
        })) || [];

      return {
        id: provider.id,
        name: provider.name,
        enabled: isProviderEnabled(provider, process.env as Record<string, string>),
        required: provider.required,
        envVarInfo: provider.envVarInfo,
        envVarStatus,
      };
    },
  );

  const customProviderStatus = customProviders.map((provider) => {
    return {
      id: provider.id,
      name: provider.name,
      enabled: true,
      isCustom: provider.isCustom,
      customRedirectPath: provider.customRedirectPath,
      envVarStatus: [],
    };
  });

  const allProviders = [...customProviderStatus, ...authProviderStatus];

  return {
    allProviders,
    isProd,
  };
}

export default function LoginPage() {
  const { allProviders, isProd } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen w-full flex-col bg-white dark:bg-black">
      <LoginClient providers={allProviders} isProd={isProd} />
    </div>
  );
}
