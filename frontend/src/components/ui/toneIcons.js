// One icon per tone (I-358): colour is never the only cue, so every status chip and the colour legend draw the icon of
// its tone beside the words.
import { AlertTriangle, CheckCircle2, Clock, Info, MinusCircle, ThumbsUp, XCircle } from "lucide-react";

export const TONE_ICONS = Object.freeze({
  success: ThumbsUp,
  done: CheckCircle2,
  warning: Clock,
  attention: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: MinusCircle,
});
