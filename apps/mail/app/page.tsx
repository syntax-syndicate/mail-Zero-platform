import HomeContent from '@/components/home/HomeContent';
import { authProxy } from '@/lib/auth-proxy';
import type { Route } from './+types/page';
import { redirect } from 'react-router';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await authProxy.api.getSession({ headers: request.headers });
  if (session?.connectionId) throw redirect('/mail/inbox');
  return null;
}

export default function Home() {
  return <HomeContent />;
}
