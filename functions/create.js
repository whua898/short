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
            // 使用 bind 防止 SQL 注入
            const existUrl = await env.DB.prepare("SELECT url as existUrl FROM links where slug = ?").bind(slug).first();

            if (existUrl) {
                // 核心逻辑：如果 Slug 已存在，检查对应的 URL 是否一致
                if (existUrl.existUrl === url) {
                    // URL 一致，直接返回成功，不报错
                    return new Response(JSON.stringify({ slug, link: `${origin}/${slug}` }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    // URL 不一致，说明该 Slug 已经被其他链接占用了
                    // 在返回的错误信息中，附带上已存在的 URL
                    return new Response(JSON.stringify({ 
                        message: 'Slug already exists.',
                        existingUrl: existUrl.existUrl 
                    }), {
                        status: 409, // 409 Conflict is a more appropriate status code
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }
        }

        // 目标 url 已存在 (即使没有自定义 slug，也检查一下是否已经生成过短链，避免重复浪费数据库空间)
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

        // 生成随机slug
        const slug2 = slug ? slug : generateRandomString(4);

        // 插入数据，使用 bind
        await env.DB.prepare(`INSERT INTO links (url, slug, ip, status, ua, create_time) 
        VALUES (?, ?, ?, 1, ?, ?)`)
        .bind(url, slug2, clientIP, userAgent, formattedDate)
        .run();

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
