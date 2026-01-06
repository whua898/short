/**
 * @api {post} /short Create Short Link
 */

// Path: functions/short.js

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

        let url, slug, overwrite;
        const contentType = request.headers.get("content-type") || "";

        // --- 参数解析逻辑 (兼容 JSON 和 FormData) ---
        if (contentType.includes("application/json")) {
            // 模式 1: JSON 请求 (当前前端使用)
            try {
                const body = await request.json();
                url = body.url;
                slug = body.slug;
                overwrite = body.overwrite || false;
            } catch (e) {
                return new Response(JSON.stringify({ Code: 0, Message: 'Invalid JSON' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
            // 模式 2: FormData 请求 (v1.mk 标准)
            try {
                const formData = await request.formData();
                const longUrlRaw = formData.get("longUrl");
                
                // v1.mk 协议中 longUrl 通常是 Base64 编码的，尝试解码
                if (longUrlRaw) {
                    // 简单的 Base64 格式检查
                    if (/^[A-Za-z0-9+/]*={0,2}$/.test(longUrlRaw) && longUrlRaw.length % 4 === 0) {
                        try {
                            url = atob(longUrlRaw);
                        } catch (e) {
                            url = longUrlRaw; // 解码失败，假设是明文
                        }
                    } else {
                        url = longUrlRaw; // 不是 Base64 格式，直接使用
                    }
                }
                
                slug = formData.get("shortKey");
                // FormData 模式下暂不支持 overwrite 参数，默认为 false
                overwrite = false; 
            } catch (e) {
                return new Response(JSON.stringify({ Code: 0, Message: 'Invalid Form Data' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        } else {
             return new Response(JSON.stringify({ Code: 0, Message: 'Unsupported Content-Type' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- 参数校验 ---
        if (!url) {
            return new Response(JSON.stringify({ Code: 0, Message: 'URL is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!/^https?:\/\/.{3,}/.test(url)) {
            return new Response(JSON.stringify({ Code: 0, Message: 'Invalid URL format' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
            return new Response(JSON.stringify({ Code: 0, Message: 'Invalid slug format' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const bodyUrl = new URL(url);
        if (bodyUrl.hostname === originurl.hostname) {
            return new Response(JSON.stringify({ Code: 0, Message: 'Cannot shorten a link to the same domain' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- 核心业务逻辑 ---
        if (slug) {
            const existUrl = await env.DB.prepare("SELECT url as existUrl FROM links where slug = ?").bind(slug).first();
            if (existUrl) {
                if (existUrl.existUrl === url) {
                    // URL 一致，直接返回成功 (v1.mk 格式)
                    return new Response(JSON.stringify({ Code: 1, ShortUrl: `${origin}/${slug}` }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } else {
                    // URL 不一致，检查 overwrite
                    if (overwrite === true) {
                        // 执行覆盖
                        await env.DB.prepare("UPDATE links SET url = ?, ip = ?, ua = ?, create_time = ? WHERE slug = ?")
                            .bind(url, clientIP, userAgent, formattedDate, slug)
                            .run();
                        return new Response(JSON.stringify({ Code: 1, ShortUrl: `${origin}/${slug}` }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        });
                    } else {
                        // 冲突，返回 409 和 existingUrl (保留高级功能)
                        return new Response(JSON.stringify({ 
                            Code: 0, 
                            Message: 'Slug already exists', 
                            existingUrl: existUrl.existUrl 
                        }), {
                            status: 409,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        });
                    }
                }
            }
        }

        // 如果没有指定 slug，检查该 URL 是否已存在短链
        if (!slug) {
            const existSlug = await env.DB.prepare("SELECT slug as existSlug FROM links where url = ?").bind(url).first();
            if (existSlug) {
                return new Response(JSON.stringify({ Code: 1, ShortUrl: `${origin}/${existSlug.existSlug}` }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // 生成新 slug 并插入
        const slug2 = slug ? slug : generateRandomString(4);

        await env.DB.prepare(`INSERT INTO links (url, slug, ip, status, ua, create_time) VALUES (?, ?, ?, 1, ?, ?)`)
            .bind(url, slug2, clientIP, userAgent, formattedDate)
            .run();

        return new Response(JSON.stringify({ Code: 1, ShortUrl: `${origin}/${slug2}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (e) {
        return new Response(JSON.stringify({ Code: 0, Message: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
