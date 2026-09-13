import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string; epId: string }> };

/**
 * The control room has no landing view of its own. It lands on Idea & Script rather than on room 1:
 * research is written once and consulted, while this is the room an episode is reopened *for*, and
 * the rail puts research one click away either direction.
 */
export default async function EpisodeControlRoomPage({ params }: Props) {
  const { id, epId } = await params;
  redirect(`/projects/${id}/episodes/${epId}/idea`);
}
