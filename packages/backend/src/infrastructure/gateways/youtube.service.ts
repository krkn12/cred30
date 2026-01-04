import axios from 'axios';

/**
 * Serviço para auditar métricas públicas do YouTube.
 */
export async function getYouTubeFullStats(videoUrl: string): Promise<{ likes: number; views: number; comments: number; subscribers: number } | null> {
    try {
        const videoId = extractVideoId(videoUrl);
        if (!videoId) return null;

        // Simulação de resposta completa para auditoria
        // Na vida real, aqui seriam chamadas à API do YouTube v3
        // likes: video.statistics.likeCount
        // comments: video.statistics.commentCount
        // subscribers: channel.statistics.subscriberCount

        return {
            likes: Math.floor(Math.random() * 500) + 100,
            views: Math.floor(Math.random() * 5000) + 200,
            comments: Math.floor(Math.random() * 50) + 5,
            subscribers: Math.floor(Math.random() * 10000) + 500
        };
    } catch (error) {
        console.error('[YOUTUBE-SERVICE] Erro ao buscar stats:', error);
        return null;
    }
}

function extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
