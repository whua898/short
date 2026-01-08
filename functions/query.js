/**
 * @api {post} /query Query Long Link
 */

// Path: functions/query.js

// 定义CORS响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // 2. 只处理 POST 请求
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ Code: 0, Message: 'Method Not Allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        let slug;
        const contentType = request.headers.get("content-type") || "";

        // --- 参数解析 ---
        if (contentType.includes("application/json")) {
            try {
                const text = await request.text();
                if (!text) {
                     return new Response(JSON.stringify({ Code: 0, Message: 'Empty Request Body' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
                const body = JSON.parse(text);
                slug = body.slug;
            } catch (e) {
                return new Response(JSON.stringify({ Code: 0, Message: 'Invalid JSON' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        } else {
             return new Response(JSON.stringify({ Code: 0, Message: 'Unsupported Content-Type. Please use application/json' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- 参数校验 ---
        if (!slug) {
            return new Response(JSON.stringify({ Code: 0, Message: 'Slug is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- 核心查询逻辑 ---
        // 查询 url 和 create_time
        const result = await env.DB.prepare("SELECT url, create_time FROM links WHERE slug = ?").bind(slug).first();

        if (result) {
            // 找到了，返回详细信息
            return new Response(JSON.stringify({ 
                Code: 1, 
                Slug: slug,
                LongUrl: result.url,
                CreateTime: result.create_time
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } else {
            // 没找到
            return new Response(JSON.stringify({ Code: 0, Message: 'Slug not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

    } catch (e) {
        return new Response(JSON.stringify({ Code: 0, Message: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
