// DecisionPanel (UI-SPEC section 4 "DecisionPanel" row, idea X-04): the one widget for the approve / return / reject
// actions the app ALREADY has. It adds no action and no permission: the caller says which actions exist (the server's
// own list decides that) and what they are called; the panel supplies the comment box, the rules about the comment, the
// button look, the confirmation for destructive ones, and the busy / error states.
//
//   <DecisionPanel
//     title="Dean decision" subject="Maria Santos · Leave of Absence"
//     actions={[
//       { key: "approve", label: "Approve", tone: "approve" },
//       { key: "return",  label: "Return for revision", tone: "return" },            // needs a comment
//       { key: "deny",    label: "Deny request", tone: "reject", confirm: { message: "The student is told." } },
//     ]}
//     onDecide={(key, comment) => api.decide(id, key, comment)}   // may be async; a throw is shown inside the panel
//   />
//
// Comment rule: return and reject need a (trimmed) comment, approve does not. With no comment the click is blocked, the
// handler is not called, a field error is shown, the box takes the focus. Reject asks first (useConfirm, danger tone;
// needs the ConfirmProvider, which main.jsx mounts), Cancel decides nothing.
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";
import { Field, Textarea } from "./Field.jsx";
import { InlineNotice } from "./Feedback.jsx";
import { useConfirm } from "../confirm.jsx";

const TONES = ["approve", "return", "reject"];
const TONE_ALIAS = { danger: "reject", deny: "reject", warn: "return", warning: "return", primary: "approve" };
const VARIANT = { approve: "primary", return: "secondary", reject: "danger" };

const toneOf = (action) => {
  const wanted = TONE_ALIAS[action.tone] || action.tone;
  if (TONES.includes(wanted)) return wanted;
  if (TONES.includes(action.key)) return action.key;
  return TONE_ALIAS[action.key] || "approve";
};

const needsComment = (action) => (action.requireComment !== undefined ? Boolean(action.requireComment) : toneOf(action) !== "approve");

/** The confirmation to ask first, or null. Reject asks by default; `confirm: false` turns that off, `true`/text/object turns it on. */
function confirmFor(action) {
  const tone = toneOf(action);
  const c = action.confirm;
  if (c === false) return null;
  if (c === undefined && tone !== "reject") return null;
  const o = c && typeof c === "object" ? c : {};
  return {
    title: o.title || `${action.label}?`,
    message: o.message || (typeof c === "string" ? c : "The decision is recorded with your name and your comment."),
    confirmLabel: o.confirmLabel || action.label,
    tone: o.tone || (tone === "reject" ? "danger" : "default"),
  };
}

const lower = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const joinOr = (words) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}` : words[0] || "");

/**
 * @param title, subject     heading and one line under it (who / what is being decided)
 * @param actions            [{ key, label, tone: "approve"|"return"|"reject", icon, hint, requireComment, disabled, confirm }]
 *                           tone defaults to the key when that is approve / return / reject, else "approve";
 *                           requireComment defaults to true for return and reject; `hint` is read out with the button and
 *                           shown under the panel while the action is disabled (the reason why);
 *                           confirm: false | true | "message" | { title, message, confirmLabel, tone }
 * @param onDecide           (key, trimmedComment) => void | Promise. A rejected promise / throw is shown as a danger notice.
 * @param busy               disables everything (a save is running somewhere else)
 * @param error, success     text for a danger / success notice above the buttons
 * @param comment, onCommentChange  controlled comment text (otherwise the panel keeps it, and empties it after a decision)
 * @param withComment        false hides the comment box (a decision with nothing to say)
 * @param commentLabel       label of the box (default "Comment for the student", or "Note (optional)" if no action needs one)
 * @param commentHint        help text under the box (default names the actions that need a comment)
 * @param commentRequiredMessage  the field error (default "Add a comment so the student knows what to fix.")
 * @param minCommentLength   shortest accepted comment for an action that needs one (default 1)
 * @param validate           (key, comment) => string | falsy; a text blocks the decision and is shown as a notice
 * @param onCancel, cancelLabel   adds a Cancel button (for a panel inside a dialog)
 * @param extra              a node at the end of the button row (a "Message" button, a read-only sentence)
 * @param children           extra controls between the comment box and the buttons (a checkbox, a select, a signature pad)
 * @param variant            "card" (default, bordered) | "plain" (no chrome, for use inside a Modal or an existing card)
 */
export function DecisionPanel({
  title,
  subject,
  actions = [],
  onDecide,
  busy = false,
  error,
  success,
  comment: controlled,
  onCommentChange,
  withComment = true,
  commentLabel,
  commentHint,
  commentRequiredMessage = "Add a comment so the student knows what to fix.",
  minCommentLength = 1,
  commentPlaceholder,
  commentRows = 3,
  maxLength = 2000,
  validate,
  onCancel,
  cancelLabel = "Cancel",
  extra,
  children,
  variant = "card",
  className = "",
  ...rest
}) {
  const confirm = useConfirm();
  const base = useId();
  const textRef = useRef(null);
  const lock = useRef(false);
  const refocus = useRef(null);
  const [own, setOwn] = useState("");
  const [pending, setPending] = useState(null);
  const [fieldError, setFieldError] = useState("");
  const [notice, setNotice] = useState("");
  const isControlled = controlled !== undefined;
  const text = isControlled ? controlled : own;
  const working = busy || pending !== null;

  const required = actions.filter(needsComment);
  const label = commentLabel || (required.length ? "Comment for the student" : "Note (optional)");
  const hint = commentHint !== undefined ? commentHint : required.length ? `Required to ${joinOr(required.map((a) => lower(a.label)))}.` : undefined;

  function setText(value) {
    if (!isControlled) setOwn(value);
    onCommentChange?.(value);
    if (fieldError) setFieldError("");
  }

  function block(message, toField) {
    if (toField) {
      setFieldError(message);
      textRef.current?.focus();
    } else {
      setNotice(message);
    }
  }

  // A busy button is disabled, and a disabled button drops the keyboard focus. Put it back when the work is over.
  useEffect(() => {
    const el = refocus.current;
    if (pending !== null || !el) return;
    refocus.current = null;
    if (el.isConnected && (!document.activeElement || document.activeElement === document.body)) el.focus();
  }, [pending]);

  async function decide(action, trigger) {
    if (lock.current || working || action.disabled) return;
    const trimmed = (text || "").trim();
    setNotice("");
    if (withComment && needsComment(action) && trimmed.length < Math.max(1, minCommentLength)) {
      block(commentRequiredMessage, true);
      return;
    }
    setFieldError("");
    const problem = validate?.(action.key, trimmed);
    if (problem) {
      block(problem, false);
      return;
    }
    const ask = confirmFor(action);
    lock.current = true;
    try {
      if (ask && !(await confirm(ask))) return;
      refocus.current = trigger || null;
      setPending(action.key);
      await onDecide?.(action.key, trimmed);
      if (!isControlled) setOwn("");
    } catch (err) {
      setNotice(err?.message || "That did not work. Try again.");
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  const titleId = `${base}-title`;
  const Root = variant === "plain" ? "div" : Card;
  const rootProps = variant === "plain" ? {} : { pad: "md" };
  const shownError = error || notice;
  const hinted = actions.filter((a) => a.hint);

  return (
    <Root
      {...rootProps}
      {...rest}
      role="group"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : "Decision"}
      className={`space-y-3 ${className}`.trim()}
    >
      {(title || subject) && (
        <div>
          {title && (
            <h3 id={titleId} className="card-title">
              {title}
            </h3>
          )}
          {subject && <p className="meta mt-0.5 break-words">{subject}</p>}
        </div>
      )}

      {withComment && (
        <Field label={label} hint={hint} error={fieldError}>
          <Textarea
            ref={textRef}
            value={text}
            rows={commentRows}
            maxLength={maxLength}
            placeholder={commentPlaceholder}
            disabled={working}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
      )}

      {children}

      {success && <InlineNotice tone="success">{success}</InlineNotice>}
      {shownError && <InlineNotice tone="danger">{shownError}</InlineNotice>}

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const tone = toneOf(action);
          const hintId = action.hint ? `${base}-hint-${action.key}` : undefined;
          return (
            <Button
              key={action.key}
              variant={VARIANT[tone]}
              icon={action.icon}
              loading={pending === action.key}
              disabled={working || action.disabled}
              aria-describedby={hintId}
              className="max-sm:w-full"
              onClick={(event) => decide(action, event.currentTarget)}
            >
              {action.label}
            </Button>
          );
        })}
        {onCancel && (
          <Button variant="secondary" disabled={working} className="max-sm:w-full" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        {extra}
      </div>

      {hinted.map((action) => (
        <p key={action.key} id={`${base}-hint-${action.key}`} className={action.disabled ? "meta" : "sr-only"}>
          {action.disabled ? `${action.label}: ${action.hint}` : action.hint}
        </p>
      ))}
    </Root>
  );
}
