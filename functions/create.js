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

// 处理 OPTIONS 预检请求
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const originurl = new URL(request.url);
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
    const userAgent = request.headers.get("user-agent");
    const origin = `${originurl.protocol}//${originurl.hostname}`

    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const timedata = new Date();
    const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata);
    
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

    if (!url) return new Response(JSON.stringify({ message: 'Missing required parameter: url.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // url格式检查
    if (!/^https?:\/\/.{3,}/.test(url)) {
        return new Response(JSON.stringify({ message: 'Illegal format: url.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let targetUrl = url;
    try {
        targetUrl = new URL(url).href;
    } catch (e) {
        return new Response(JSON.stringify({ message: 'Illegal format: url.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 自定义slug长度检查 2<slug<10 是否不以文件后缀结尾
    if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
        return new Response(JSON.stringify({ message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    try {

        // 如果自定义slug
        if (slug) {
            const existUrl = await env.DB.prepare('SELECT url as existUrl FROM links where slug = ?').bind(slug).first();

            // url & slug 是一样的。
            if (existUrl) {
                let existUrlNormalized = existUrl.existUrl;
                try {
                    existUrlNormalized = new URL(existUrl.existUrl).href;
                } catch (e) {}

                if (existUrlNormalized === targetUrl) {
                    return new Response(JSON.stringify({ slug, link: `${origin}/${slug}` }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }

                // slug 已存在
                return new Response(JSON.stringify({ message: 'Slug already exists.' }), {
                    status: 409,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // 目标 url 已存在
        const existSlug = await env.DB.prepare('SELECT slug as existSlug FROM links where url = ?').bind(targetUrl).first();

        // url 存在且没有自定义 slug
        if (existSlug && !slug) {
            return new Response(JSON.stringify({ slug: existSlug.existSlug, link: `${origin}/${existSlug.existSlug}` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const bodyUrl = new URL(targetUrl);

        if (bodyUrl.hostname === originurl.hostname) {
            return new Response(JSON.stringify({ message: 'You cannot shorten a link to the same domain.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 生成随机slug
        let slug2 = slug ? slug : generateRandomString(4);

        if (!slug) {
            let exist = await env.DB.prepare('SELECT slug FROM links where slug = ?').bind(slug2).first();
            while (exist) {
                slug2 = generateRandomString(4);
                exist = await env.DB.prepare('SELECT slug FROM links where slug = ?').bind(slug2).first();
            }
        }

        const info = await env.DB.prepare('INSERT INTO links (url, slug, ip, status, ua, create_time) VALUES (?, ?, ?, 1, ?, ?)').bind(targetUrl, slug2, clientIP, userAgent, formattedDate).run();

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
