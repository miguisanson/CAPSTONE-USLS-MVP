// Shim (P5.3): the leave window shell is now the library Modal. The only importer left is
// components/ProcessBoardPage.jsx (the "How this works" and "Recent activity" windows), which is outside this packet;
// it keeps the old props (`id`, `size="wide"`, `layer`), so this adapter maps them. Delete it with ProcessBoardPage's import.
import { Modal } from "../../components/ui/index.js";

export default function ModalShell({ id: _id, size = "default", layer: _layer, ...props }) {
  return <Modal size={size === "wide" ? "lg" : "md"} {...props} />;
}
