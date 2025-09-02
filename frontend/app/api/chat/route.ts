export async function POST(req: Request) {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] API Request started`)

  try {
    // pass-through any JSON shape; default to { message } if plain text
    const raw = await req.text()
    console.log("Raw request body:", raw?.substring(0, 200) + (raw?.length > 200 ? "..." : ""))

    let body: any = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      body = { message: raw }
    }
    console.log("Parsed request body:", JSON.stringify(body, null, 2))

    // Build payload expected by the new API
    const message =
      typeof body?.message === "string" && body.message.trim().length > 0 ? body.message : String(raw || "")
    const user_id =
      typeof body?.user_id === "string" && body.user_id.trim().length > 0
        ? body.user_id
        : `web-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
    const generate_image = true

    const payload = { message, user_id, generate_image }
    console.log("Upstream payload:", JSON.stringify(payload, null, 2))

    // Create AbortController for 2-minute timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => {
        console.log("Request timed out after 2 minutes")
        controller.abort()
      },
      2 * 60 * 1000,
    ) // 2 minutes in milliseconds

    try {
      console.log("Making upstream request to:", "https://llm-auditor-api-281695378046.us-central1.run.app/query")

      const upstream = await fetch("https://llm-auditor-api-281695378046.us-central1.run.app/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal, // Add timeout signal
      })

      const responseTime = Date.now() - startTime
      console.log(`Upstream response received in ${responseTime}ms`)
      console.log("Upstream response status:", upstream.status)
      console.log("Upstream response headers:", Object.fromEntries(upstream.headers.entries()))

      // Clear timeout if request completes successfully
      clearTimeout(timeoutId)

      const contentType = upstream.headers.get("content-type") || ""
      console.log("Content-Type:", contentType)

      if (contentType.includes("application/json")) {
        const data = await upstream.json()
        console.log("Upstream JSON response:", JSON.stringify(data, null, 2))
        console.log(`Request completed successfully in ${Date.now() - startTime}ms`)

        if (data.justifyai_response) {
          console.log("Response already has justifyai_response wrapper")
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          })
        }

        // If not, wrap the response in the expected structure
        console.log("Wrapping response in justifyai_response structure")
        const wrappedResponse = {
          justifyai_response: {
            original_query: message,
            session_id: data.session_id || `session-${Date.now()}`,
            formatted_content: {
              concise: data.response || data.content || data.answer || JSON.stringify(data),
              detailed: data.detailed_response || data.response || data.content || data.answer || JSON.stringify(data),
            },
            generated_media: {
              images: data.images || data.generated_images || [],
            },
            proof: Array.isArray(data.sources)
              ? data.sources
              : Array.isArray(data.proof)
                ? data.proof
                : Array.isArray(data.references)
                  ? data.references
                  : [],
            processing_timestamp: data.timestamp || Date.now() / 1000,
            status: data.status || "success",
          },
        }

        console.log("Wrapped response:", JSON.stringify(wrappedResponse, null, 2))
        return new Response(JSON.stringify(wrappedResponse), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        })
      } else {
        const text = await upstream.text()
        console.log("Upstream text response:", text?.substring(0, 500) + (text?.length > 500 ? "..." : ""))
        console.log(`Request completed successfully in ${Date.now() - startTime}ms`)

        // Wrap text response in expected structure
        const wrappedResponse = {
          justifyai_response: {
            original_query: message,
            session_id: `session-${Date.now()}`,
            formatted_content: {
              concise: text,
              detailed: text,
            },
            generated_media: { images: [] },
            proof: [],
            processing_timestamp: Date.now() / 1000,
            status: "success",
          },
        }

        return new Response(JSON.stringify(wrappedResponse), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        })
      }
    } catch (fetchError) {
      // Clear timeout in case of error
      clearTimeout(timeoutId)

      // Check if error was due to timeout
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.log("Request aborted due to timeout")
        return Response.json(
          {
            justifyai_response: {
              original_query: message,
              session_id: "",
              formatted_content: {
                concise: "Request timed out after 2 minutes. Please try again.",
                detailed: "Request timed out after 2 minutes. Please try again.",
              },
              generated_media: { images: [] },
              proof: [],
              processing_timestamp: Date.now() / 1000,
              status: "timeout",
            },
          },
          { status: 408 },
        )
      }

      console.log("Fetch error:", fetchError)
      // Re-throw other fetch errors to be caught by outer catch
      throw fetchError
    }
  } catch (e) {
    const totalTime = Date.now() - startTime
    console.error(`Request failed after ${totalTime}ms:`, e)

    // Return network error in expected format
    return Response.json(
      {
        justifyai_response: {
          original_query: "Unknown",
          session_id: "",
          formatted_content: {
            concise: "Network error. Please try again.",
            detailed: `Network error occurred: ${e instanceof Error ? e.message : String(e)}`,
          },
          generated_media: { images: [] },
          proof: [],
          processing_timestamp: Date.now() / 1000,
          status: "network_error",
        },
      },
      { status: 500 },
    )
  }
}
