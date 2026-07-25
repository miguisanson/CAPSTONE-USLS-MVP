import { CornerDownRight, MessageSquare, Reply } from "lucide-react";
import { formatDateTime } from "../lib/format";
import { StatusBadge } from "./ui";

function messageTime(message) {
  const timestamp = new Date(message.created_at || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function messageSort(left, right) {
  return messageTime(left) - messageTime(right) || Number(left.id || 0) - Number(right.id || 0);
}

export function buildWorkflowMessageThread(messages = []) {
  const ordered = [...messages].sort(messageSort);
  const nodes = new Map(
    ordered.map((message, position) => [String(message.id), { message, position, children: [] }])
  );
  const roots = [];

  ordered.forEach((message, position) => {
    const node = nodes.get(String(message.id));
    const parent = message.reply_to_message_id
      ? nodes.get(String(message.reply_to_message_id))
      : null;

    // A valid reply always points to an earlier post. Treat missing, self, or
    // malformed forward references as roots so the discussion remains readable.
    if (parent && parent !== node && parent.position < position) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const flattened = [];
  function visit(node, depth = 0, parent = null) {
    flattened.push({ ...node, depth, parent: parent?.message || null });
    node.children.sort((left, right) => messageSort(left.message, right.message));
    node.children.forEach((child) => visit(child, depth + 1, node));
  }
  roots.forEach((root) => visit(root));
  return flattened;
}

function senderLabel(message) {
  return message.sender_name || message.sender_role || "Unknown sender";
}

function senderInitial(message) {
  return senderLabel(message).trim().charAt(0).toUpperCase() || "?";
}

function senderIdentity(message) {
  const sender = senderLabel(message);
  const role = message.sender_role;
  return role && sender !== role ? `${sender} (${role})` : sender;
}

export default function WorkflowDiscussion({
  messages = [],
  title = "Case discussion / reviewer remarks",
  emptyText = "No submission remarks or reviewer comments yet.",
  embedded = false,
  showHeader = true,
  onReply = null,
  canReply = null,
  renderMessageFooter = null,
  highlightLatest = false,
}) {
  const thread = buildWorkflowMessageThread(messages);
  const latestMessage = [...messages].sort(messageSort).at(-1) || null;
  const latestOnlyHighlight = highlightLatest || messages.some((message) => ["practicum", "graduation"].includes(message.transaction_slug));

  return (
    <div className={embedded ? "" : "rounded-xl border border-slate-200 bg-white p-4"}>
      {showHeader && <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <MessageSquare className="h-4 w-4" /> {title}
        </p>
        <StatusBadge value={`${messages.length} message${messages.length === 1 ? "" : "s"}`} dot={false} />
      </div>}

      {!thread.length ? (
        <p className={`${showHeader ? "mt-3" : ""} rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500`}>{emptyText}</p>
      ) : (
        <ol className={`${showHeader ? "mt-3" : ""} space-y-3`} aria-label={title}>
          {thread.map(({ message, depth, parent }, index) => {
            const key = message.id || `${message.transaction_slug || "message"}-${index}`;
            const visualDepth = Math.min(depth, 4);
            const isActionMessage = ["submission", "forward", "return", "response"].includes(message.action_type);
            const isLatest = message === latestMessage;
            const isHighlighted = latestOnlyHighlight ? isLatest : isActionMessage;
            const replyAllowed = Boolean(onReply) && (canReply ? canReply(message) : true);

            return (
              <li
                key={key}
                className={`relative ${depth > 0 ? "border-l-2 border-slate-200 pl-3 sm:pl-4" : ""}`}
                style={{ marginLeft: `${visualDepth * 18}px` }}
                aria-label={depth > 0 ? `Reply level ${depth}` : "Discussion post"}
              >
                {depth > 0 && <span aria-hidden="true" className="absolute -left-0.5 top-5 h-px w-3 bg-slate-200" />}
                <article className={`rounded-xl border p-3 text-sm shadow-sm ${isHighlighted ? "border-emerald-300 bg-emerald-50" : latestOnlyHighlight ? "border-slate-200 bg-white" : depth > 0 ? "border-slate-200 bg-slate-50/80" : "border-slate-200 bg-white"}`}>
                  {parent && (
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                      <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                      Replying to {senderLabel(parent)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${depth > 0 ? "bg-slate-200 text-slate-700" : "bg-brand-100 text-brand-800"}`}>
                        {senderInitial(message)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-relaxed text-ink">
                          {senderIdentity(message)} <span className="mx-1 text-slate-400">→</span> {message.recipient_role || "Recipient not recorded"}
                        </p>
                      </div>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      {latestOnlyHighlight && isLatest && <StatusBadge value="Latest" dot={false} />}
                      {message.visibility && <StatusBadge value={message.visibility === "internal" ? "Internal" : "Student visible"} dot={false} />}
                      <StatusBadge value={message.status || "Message"} dot={false} />
                    </span>
                  </div>
                  {message.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{message.comment}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
                    <time className="text-xs font-medium text-slate-500" dateTime={message.created_at || undefined}>{formatDateTime(message.created_at)}</time>
                    {replyAllowed && (
                      <button type="button" onClick={() => onReply(message)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors duration-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                        <Reply className="h-3.5 w-3.5" /> Reply
                      </button>
                    )}
                  </div>
                  {renderMessageFooter?.(message, key)}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
