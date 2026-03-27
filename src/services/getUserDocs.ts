import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export const getUserDocuments = async (userId: string): Promise<Array<{
    id: string;
    source: string;
    createdAt: string;
}>> => {
    const { data, error } = await supabase
        .from('documents')
        .select('id, metadata, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('Failed to fetch documents:', error);
        throw new Error('Failed to fetch documents');
    }

    const seen = new Set<string>();
    const documents = [];

    for (const row of data || []) {
        const source = row.metadata?.source;
        if (source && !seen.has(source)) {
            seen.add(source);
            documents.push({
                id: row.id,
                source,
                createdAt: row.created_at,
            });
        }
    }

    logger.log(`getUserDocuments → ${documents.length} documents for user ${userId}`);
    return documents;
};