import { ChatPane } from './ChatPane';

export const instant = false;

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatPane id={Number(id)} />;
}
