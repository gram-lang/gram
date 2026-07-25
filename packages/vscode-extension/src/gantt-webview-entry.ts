import { attachGanttInteractivity } from "@gram-lang/renderer";

const container = document.getElementById("content") as HTMLElement;
const handle = attachGanttInteractivity(container, {
	timeMode: "forward",
	targetTime: "",
	isCompactMode: false,
});

window.addEventListener("message", (event) => {
	const message = event.data;
	if (message.command === "updateContent") {
		const preserved = handle.getOptions();
		container.innerHTML = message.html;
		handle.setOptions(preserved);
	}
});
