/**
 * @api {get} /list List Custom Slugs
 */

// Path: functions/list.js

// 定义CORS响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
    const { request, env } = context;

    // 1. 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    // 2. 只处理 GET 请求
    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ Code: 0, Message: 'Method Not Allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        // 查询所有 status = 2 的记录 (即自定义短链)
        // 按创建时间倒序排列，限制 100 条
        const results = await env.DB.prepare("SELECT slug, url FROM links WHERE status = 2 ORDER BY id DESC LIMIT 100").all();

        return new Response(JSON.stringify({ 
            Code: 1, 
            Data: results.results 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        return new Response(JSON.stringify({ Code: 0, Message: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
