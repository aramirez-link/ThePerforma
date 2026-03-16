type FormEmailContact = {
  name?: string;
  email?: string;
  phone?: string | null;
  organization?: string | null;
  role?: string | null;
  preference?: string | null;
};

type EstimateLine = {
  label?: string;
  low?: number;
  high?: number;
  note?: string;
};

type BookingPayload = {
  kind?: "booking";
  formName?: string;
  sourcePath?: string;
  submittedAt?: string;
  requestLabel?: string;
  contact?: FormEmailContact;
  event?: {
    eventType?: string;
    venueType?: string;
    eventName?: string | null;
    location?: string;
    targetDate?: string | null;
    attendeeCount?: number | null;
    ticketingModel?: string | null;
  };
  creative?: {
    audienceDescription?: string | null;
    vibeProfile?: string | null;
    productionAmbition?: string | null;
    liveElements?: string[];
    productionNeeds?: string[];
    notes?: string | null;
  };
  budget?: {
    budgetSignal?: string | null;
    followUpConsent?: string;
    outreachConsent?: string;
  };
  recommendation?: {
    tier?: string;
    label?: string;
    rationale?: string;
    components?: string[];
  };
  estimate?: {
    lines?: EstimateLine[];
    totalLow?: number;
    totalHigh?: number;
    confidenceNote?: string;
  };
  aiSummary?: string;
  metadata?: Record<string, unknown>;
};

type ContactPayload = {
  kind?: "contact";
  formName?: string;
  sourcePath?: string;
  submittedAt?: string;
  contact?: FormEmailContact;
  details?: {
    interest?: string;
    notes?: string | null;
  };
  metadata?: Record<string, unknown>;
};

type FormPayload = BookingPayload | ContactPayload;

const INTERNAL_TO_EMAIL = "info@link-collective.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrency = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(Math.round(value))
    : "Not provided";

const formatTimestamp = (value: unknown) => {
  const input = typeof value === "string" ? value : "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const renderRows = (rows: Array<[string, unknown]>) => {
  const filtered = rows.filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().length > 0;
  });

  if (!filtered.length) return "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${filtered
        .map(([label, value]) => {
          const formattedValue = Array.isArray(value) ? value.join(", ") : String(value);
          return `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;width:210px;font:600 13px/1.4 Arial,sans-serif;color:#111827;vertical-align:top">
                ${escapeHtml(label)}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font:400 13px/1.6 Arial,sans-serif;color:#374151">
                ${escapeHtml(formattedValue)}
              </td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
};

const renderList = (items: unknown, emptyLabel = "None provided") => {
  if (!Array.isArray(items) || !items.length) {
    return `<p style="margin:0;font:400 13px/1.6 Arial,sans-serif;color:#374151">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <ul style="margin:0;padding-left:18px;font:400 13px/1.7 Arial,sans-serif;color:#374151">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
};

const renderSection = (title: string, content: string) => `
  <section style="margin-top:20px;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff">
    <h2 style="margin:0 0 14px;font:700 16px/1.3 Arial,sans-serif;color:#111827">${escapeHtml(title)}</h2>
    ${content}
  </section>
`;

const renderParagraph = (value: unknown, emptyLabel = "Not provided") => `
  <p style="margin:0;font:400 13px/1.7 Arial,sans-serif;color:#374151;white-space:pre-wrap">
    ${escapeHtml(value || emptyLabel)}
  </p>
`;

const renderMetadata = (value: unknown) => {
  if (!value || typeof value !== "object" || !Object.keys(value as Record<string, unknown>).length) {
    return "";
  }

  return renderSection(
    "Technical Context",
    `<pre style="margin:0;padding:14px;border-radius:12px;background:#0f172a;color:#e5e7eb;font:12px/1.6 Consolas,Monaco,monospace;overflow:auto">${escapeHtml(
      JSON.stringify(value, null, 2)
    )}</pre>`
  );
};

const getSubject = (payload: FormPayload) => {
  const formName = String(payload.formName || "Website form");
  const contactName = String(payload.contact?.name || "Unknown contact");

  if (payload.kind === "booking") {
    const requestLabel = String((payload as BookingPayload).requestLabel || "Booking request");
    const eventName = String((payload as BookingPayload).event?.eventName || "").trim();
    return eventName
      ? `${requestLabel}: ${contactName} / ${eventName}`
      : `${requestLabel}: ${contactName}`;
  }

  const interest = String((payload as ContactPayload).details?.interest || "Contact request");
  return `${formName}: ${contactName} / ${interest}`;
};

const buildBookingHtml = (payload: BookingPayload) => {
  const estimateLines = Array.isArray(payload.estimate?.lines) ? payload.estimate?.lines || [] : [];

  const estimateTable = estimateLines.length
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <th align="left" style="padding:0 0 10px;font:700 12px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">Line Item</th>
          <th align="left" style="padding:0 0 10px;font:700 12px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">Low</th>
          <th align="left" style="padding:0 0 10px;font:700 12px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">High</th>
        </tr>
        ${estimateLines
          .map(
            (line) => `
              <tr>
                <td style="padding:10px 0;border-top:1px solid #e5e7eb;font:600 13px/1.5 Arial,sans-serif;color:#111827">${escapeHtml(line.label || "Line item")}</td>
                <td style="padding:10px 0;border-top:1px solid #e5e7eb;font:400 13px/1.5 Arial,sans-serif;color:#374151">${escapeHtml(formatCurrency(line.low))}</td>
                <td style="padding:10px 0;border-top:1px solid #e5e7eb;font:400 13px/1.5 Arial,sans-serif;color:#374151">${escapeHtml(formatCurrency(line.high))}</td>
              </tr>
              ${
                line.note
                  ? `
                    <tr>
                      <td colspan="3" style="padding:0 0 10px;border-bottom:1px solid #e5e7eb;font:400 12px/1.6 Arial,sans-serif;color:#6b7280">
                        ${escapeHtml(line.note)}
                      </td>
                    </tr>
                  `
                  : ""
              }
            `
          )
          .join("")}
      </table>
    `
    : renderParagraph("No estimate lines were included.");

  return `
    <div style="margin:0 auto;padding:32px 20px;background:#f3f4f6">
      <div style="max-width:760px;margin:0 auto">
        <div style="padding:28px 28px 24px;border-radius:24px;background:linear-gradient(135deg,#111827,#1f2937);color:#ffffff">
          <p style="margin:0;font:700 11px/1.4 Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b">
            The Performa Booking Intake
          </p>
          <h1 style="margin:12px 0 0;font:700 28px/1.2 Arial,sans-serif">${escapeHtml(
            payload.requestLabel || "Booking request"
          )}</h1>
          <p style="margin:12px 0 0;font:400 14px/1.7 Arial,sans-serif;color:#d1d5db">
            New booking submission received from ${escapeHtml(payload.formName || "website booking form")}.
          </p>
        </div>

        ${renderSection(
          "Submission Summary",
          renderRows([
            ["Form", payload.formName || "Website form"],
            ["Submitted", formatTimestamp(payload.submittedAt)],
            ["Source path", payload.sourcePath || "/"],
            ["Requested next step", payload.requestLabel || "Booking request"]
          ])
        )}

        ${renderSection(
          "Contact Details",
          renderRows([
            ["Name", payload.contact?.name || "Not provided"],
            ["Email", payload.contact?.email || "Not provided"],
            ["Phone", payload.contact?.phone || null],
            ["Organization", payload.contact?.organization || null],
            ["Role", payload.contact?.role || null],
            ["Preferred contact method", payload.contact?.preference || null]
          ])
        )}

        ${renderSection(
          "Event Overview",
          renderRows([
            ["Event type", payload.event?.eventType || "Not provided"],
            ["Venue type", payload.event?.venueType || "Not provided"],
            ["Event name", payload.event?.eventName || null],
            ["Location", payload.event?.location || "Not provided"],
            ["Target date", payload.event?.targetDate || null],
            ["Attendee count", payload.event?.attendeeCount ?? null],
            ["Ticketing model", payload.event?.ticketingModel || null]
          ])
        )}

        ${renderSection(
          "Experience and Production",
          `
            ${renderRows([
              ["Production ambition", payload.creative?.productionAmbition || null],
              ["Vibe profile", payload.creative?.vibeProfile || null],
              ["Budget signal", payload.budget?.budgetSignal || null],
              ["Follow-up consent", payload.budget?.followUpConsent || "Not provided"],
              ["Outreach consent", payload.budget?.outreachConsent || "Not provided"]
            ])}
            <div style="margin-top:16px">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Audience description</p>
              ${renderParagraph(payload.creative?.audienceDescription)}
            </div>
            <div style="margin-top:16px">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Live elements</p>
              ${renderList(payload.creative?.liveElements)}
            </div>
            <div style="margin-top:16px">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Production needs</p>
              ${renderList(payload.creative?.productionNeeds)}
            </div>
            ${
              payload.creative?.notes
                ? `
                  <div style="margin-top:16px">
                    <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Additional notes</p>
                    ${renderParagraph(payload.creative.notes)}
                  </div>
                `
                : ""
            }
          `
        )}

        ${renderSection(
          "Recommended Package",
          `
            ${renderRows([
              ["Recommended package", payload.recommendation?.label || "Not provided"],
              ["Package tier", payload.recommendation?.tier || null]
            ])}
            <div style="margin-top:16px">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Rationale</p>
              ${renderParagraph(payload.recommendation?.rationale)}
            </div>
            <div style="margin-top:16px">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Included components</p>
              ${renderList(payload.recommendation?.components)}
            </div>
          `
        )}

        ${renderSection(
          "Estimate Snapshot",
          `
            ${renderRows([
              ["Estimated low", formatCurrency(payload.estimate?.totalLow)],
              ["Estimated high", formatCurrency(payload.estimate?.totalHigh)]
            ])}
            <div style="margin-top:16px">${estimateTable}</div>
            <div style="margin-top:16px">
              <p style="margin:0 0 8px;font:700 13px/1.4 Arial,sans-serif;color:#111827">Confidence note</p>
              ${renderParagraph(payload.estimate?.confidenceNote)}
            </div>
          `
        )}

        ${renderSection(
          "AI Summary",
          renderParagraph(payload.aiSummary, "No AI summary was provided.")
        )}

        ${renderMetadata(payload.metadata)}
      </div>
    </div>
  `;
};

const buildContactHtml = (payload: ContactPayload) => `
  <div style="margin:0 auto;padding:32px 20px;background:#f3f4f6">
    <div style="max-width:760px;margin:0 auto">
      <div style="padding:28px 28px 24px;border-radius:24px;background:linear-gradient(135deg,#111827,#1f2937);color:#ffffff">
        <p style="margin:0;font:700 11px/1.4 Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b">
          The Performa Contact Intake
        </p>
        <h1 style="margin:12px 0 0;font:700 28px/1.2 Arial,sans-serif">${escapeHtml(
          payload.formName || "Contact request"
        )}</h1>
        <p style="margin:12px 0 0;font:400 14px/1.7 Arial,sans-serif;color:#d1d5db">
          New contact submission received from ${escapeHtml(payload.sourcePath || "/")}.
        </p>
      </div>

      ${renderSection(
        "Submission Summary",
        renderRows([
          ["Form", payload.formName || "Website form"],
          ["Submitted", formatTimestamp(payload.submittedAt)],
          ["Source path", payload.sourcePath || "/"],
          ["Interest", payload.details?.interest || "Not provided"]
        ])
      )}

      ${renderSection(
        "Contact Details",
        renderRows([
          ["Name", payload.contact?.name || "Not provided"],
          ["Email", payload.contact?.email || "Not provided"],
          ["Phone", payload.contact?.phone || null]
        ])
      )}

      ${renderSection(
        "Request Notes",
        renderParagraph(payload.details?.notes, "No additional notes were submitted.")
      )}

      ${renderMetadata(payload.metadata)}
    </div>
  </div>
`;

const buildHtml = (payload: FormPayload) =>
  payload.kind === "booking" ? buildBookingHtml(payload as BookingPayload) : buildContactHtml(payload as ContactPayload);

const isValidPayload = (payload: FormPayload) => {
  if (payload.kind !== "booking" && payload.kind !== "contact") {
    return "Unsupported form payload.";
  }

  const email = String(payload.contact?.email || "").trim();
  const name = String(payload.contact?.name || "").trim();
  if (!name) return "Contact name is required.";
  if (!EMAIL_RE.test(email)) return "A valid contact email is required.";

  if (payload.kind === "booking") {
    if (!String((payload as BookingPayload).requestLabel || "").trim()) {
      return "Booking request label is required.";
    }
  }

  if (payload.kind === "contact") {
    if (!String((payload as ContactPayload).details?.interest || "").trim()) {
      return "Contact interest is required.";
    }
  }

  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "";
  if (!resendApiKey || !resendFrom) {
    return json(500, { error: "Resend is not configured." });
  }

  const payload = (await req.json().catch(() => ({}))) as FormPayload;
  const validationError = isValidPayload(payload);
  if (validationError) return json(400, { error: validationError });

  const subject = getSubject(payload);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [INTERNAL_TO_EMAIL],
      subject,
      reply_to: payload.contact?.email,
      html: buildHtml(payload)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json(400, {
      error: typeof data?.message === "string" ? data.message : "Failed to send form submission email."
    });
  }

  return json(200, {
    ok: true,
    subject,
    recipient: INTERNAL_TO_EMAIL
  });
});
