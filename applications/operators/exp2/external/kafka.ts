import { Kafka } from 'kafkajs';

export async function getMessagesInQueue({
    brokers,
    clientId,
    groupId,
    topic,
}: {
    brokers: string[];
    clientId: string;
    groupId: string;
    topic: string;
}): Promise<number> {
    const kafka = new Kafka({ clientId, brokers });
    const admin = kafka.admin();

    try {
        await admin.connect();
        const topicOffsets = await admin.fetchTopicOffsets(topic);
        const groupOffsets = await admin.fetchOffsets({ groupId, topics: [topic] });
        const committedPartitions = groupOffsets[0]?.partitions ?? [];

        let totalLag = 0;
        topicOffsets.forEach((partition) => {
            const partitionId = partition.partition;
            const latestOffset = parseInt(partition.offset, 10);

            const groupOffset = committedPartitions.find(
                (p: { partition: number }) => p.partition === partitionId
            );
            const committedOffset =
                groupOffset && groupOffset.offset !== '-1'
                    ? parseInt(groupOffset.offset, 10)
                    : 0;

            totalLag += latestOffset - committedOffset;
        });

        return totalLag;
    } catch (error) {
        console.error('❌ Error', error);
        throw error;
    } finally {
        await admin.disconnect();
    }
}
