/**
 * @api {post} /create Create
 */

// Path: functions/create.js

// 定义CORS响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateRandomString(length) {
    const characters = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}

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
        return new Response('Method Not Allowed', {
            status: 405,
            headers: corsHeaders,
        });
    }

    // 3. 处理 POST 请求的核心逻辑
    try {
        const originurl = new URL(request.url);
        const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
        const userAgent = request.headers.get("user-agent");
        const origin = `${originurl.protocol}//${originurl.hostname}`;

        const options = {
            timeZone: 'Asia/Shanghai',
            year: 'numeric', month: 'long', day: 'numeric',
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        };
        const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(new Date());

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ message: 'Invalid JSON' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { url, slug } = body;

        if (!url) {
            return new Response(JSON.stringify({ message: 'Missing required parameter: url.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!/^https?:\/\/.{3,}/.test(url)) {
            return new Response(JSON.stringify({ message: 'Illegal format: url.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
            return new Response(JSON.stringify({ message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (slug) {
            const existUrl = await env.DB.prepare("SELECT url as existUrl FROM links where slug = ?").bind(slug).first();
            if (existUrl) {
                if (existUrl.existUrl === url) {
                    return new Response(JSON.stringify({ slug, link: `${origin}/${slug}` }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    return new Response(JSON.stringify({ message: 'Slug already exists.', existingUrl: existUrl.existUrl }), {
                        status: 409,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }
        }

        if (!slug) {
            const existSlug = await env.DB.prepare("SELECT slug as existSlug FROM links where url = ?").bind(url).first();
            if (existSlug) {
                return new Response(JSON.stringify({ slug: existSlug.existSlug, link: `${origin}/${existSlug.existSlug}` }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        const bodyUrl = new URL(url);
        if (bodyUrl.hostname === originurl.hostname) {
            return new Response(JSON.stringify({ message: 'You cannot shorten a link to the same domain.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const slug2 = slug ? slug : generateRandomString(4);

        await env.DB.prepare(`INSERT INTO links (url, slug, ip, status, ua, create_time) VALUES (?, ?, ?, 1, ?, ?)`).bind(url, slug2, clientIP, userAgent, formattedDate).run();

        return new Response(JSON.stringify({ slug: slug2, link: `${origin}/${slug2}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
