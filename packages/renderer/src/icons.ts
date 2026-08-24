import type { RendererIcons } from "./types";

const svgIcon = (iconName: string, path: string) =>
	`<svg class="gicon gicon-${iconName}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;

// Each icon is its own top-level binding (rather than a property read off a
// shared object) so bundlers can tree-shake per icon: PRINT_ICONS only needs
// four of these, and a consumer that imports just PRINT_ICONS (e.g. the
// VS Code Gantt webview bundle) must not have to carry the other fourteen.
const hourglassIcon = /* @__PURE__ */ svgIcon(
	"hourglass",
	"M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64ZM184,216H72V180l56-42,56,42.35Zm0-140.36L128,118,72,76V40H184Z",
);
const timerIcon = /* @__PURE__ */ svgIcon(
	"timer",
	"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM173.66,90.34a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32l40-40A8,8,0,0,1,173.66,90.34ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z",
);
const thermometerIcon = /* @__PURE__ */ svgIcon(
	"thermometer",
	"M212,56a28,28,0,1,0,28,28A28,28,0,0,0,212,56Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,212,96Zm-84,57V88a8,8,0,0,0-16,0v65a32,32,0,1,0,16,0Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,120,200Zm40-66V48a40,40,0,0,0-80,0v86a64,64,0,1,0,80,0Zm-40,98a48,48,0,0,1-27.42-87.4A8,8,0,0,0,96,138V48a24,24,0,0,1,48,0v90a8,8,0,0,0,3.42,6.56A48,48,0,0,1,120,232Z",
);
const caretRightIcon = /* @__PURE__ */ svgIcon(
	"caret-circle-right",
	"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm29.66-93.66a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32L140.69,128,106.34,93.66a8,8,0,0,1,11.32-11.32Z",
);
const arrowRightIcon = /* @__PURE__ */ svgIcon(
	"arrow-right",
	"M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z",
);
const arrowUDownLeftIcon = /* @__PURE__ */ svgIcon(
	"arrow-u-down-left",
	"M232,112a64.07,64.07,0,0,1-64,64H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48a8,8,0,0,1,11.32,11.32L51.31,160H168a48,48,0,0,0,0-96H80a8,8,0,0,1,0-16h88A64.07,64.07,0,0,1,232,112Z",
);
const arrowElbowDownRightIcon = /* @__PURE__ */ svgIcon(
	"arrow-elbow-down-right",
	"M221.66,181.66l-48,48a8,8,0,0,1-11.32-11.32L196.69,184H72a8,8,0,0,1-8-8V32a8,8,0,0,1,16,0V168H196.69l-34.35-34.34a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,221.66,181.66Z",
);
const warningIcon = /* @__PURE__ */ svgIcon(
	"warning",
	"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z",
);
const pencilSimpleIcon = /* @__PURE__ */ svgIcon(
	"pencil-simple",
	"M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z",
);
const minusIcon = /* @__PURE__ */ svgIcon(
	"minus",
	"M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z",
);
const plusIcon = /* @__PURE__ */ svgIcon(
	"plus",
	"M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z",
);
const clockIcon = /* @__PURE__ */ svgIcon(
	"clock",
	"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z",
);
const clockCounterClockwiseIcon = /* @__PURE__ */ svgIcon(
	"clock-counter-clockwise",
	"M136,80v43.47l36.12,21.67a8,8,0,0,1-8.24,13.72l-40-24A8,8,0,0,1,120,128V80a8,8,0,0,1,16,0Zm-8-48A95.44,95.44,0,0,0,60.08,60.15C52.81,67.51,46.35,74.59,40,82V64a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16H49c7.15-8.42,14.27-16.35,22.39-24.57a80,80,0,1,1,1.66,114.75,8,8,0,1,0-11,11.64A96,96,0,1,0,128,32Z",
);
const fireIcon = /* @__PURE__ */ svgIcon(
	"fire",
	"M183.89,153.34a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68ZM216,144a88,88,0,0,1-176,0c0-27.92,11-56.47,32.66-84.85a8,8,0,0,1,11.93-.89l24.12,23.41,22-60.41a8,8,0,0,1,12.63-3.41C165.21,36,216,84.55,216,144Zm-16,0c0-46.09-35.79-85.92-58.21-106.33L119.52,98.74a8,8,0,0,1-13.09,3L80.06,76.16C64.09,99.21,56,122,56,144a72,72,0,0,0,144,0Z",
);
const knifeIcon = /* @__PURE__ */ svgIcon(
	"knife",
	"M231.87,32.13a27.84,27.84,0,0,0-39.32,0L18.34,206.4a8,8,0,0,0,3.86,13.45A160.67,160.67,0,0,0,58.4,224c32.95,0,65.92-10.2,96.95-30.23,31.76-20.5,50.19-43.82,51-44.81a8,8,0,0,0-.64-10.59L185.32,118l46.55-46.56A27.85,27.85,0,0,0,231.87,32.13ZM189.1,144.44a220.41,220.41,0,0,1-42.86,36.16c-34.43,22.1-69.94,30.92-105.77,26.3L146,101.33Zm31.46-84.3L174,106.7,157.32,90l46.55-46.56a11.8,11.8,0,0,1,16.69,16.69Z",
);
const scalesIcon = /* @__PURE__ */ svgIcon(
	"scales",
	"M239.43,133l-32-80h0a8,8,0,0,0-9.16-4.84L136,62V40a8,8,0,0,0-16,0V65.58L54.26,80.19A8,8,0,0,0,48.57,85h0v.06L16.57,165a7.92,7.92,0,0,0-.57,3c0,23.31,24.54,32,40,32s40-8.69,40-32a7.92,7.92,0,0,0-.57-3L66.92,93.77,120,82V208H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16H136V78.42L187,67.1,160.57,133a7.92,7.92,0,0,0-.57,3c0,23.31,24.54,32,40,32s40-8.69,40-32A7.92,7.92,0,0,0,239.43,133ZM56,184c-7.53,0-22.76-3.61-23.93-14.64L56,109.54l23.93,59.82C78.76,180.39,63.53,184,56,184Zm144-32c-7.53,0-22.76-3.61-23.93-14.64L200,77.54l23.93,59.82C222.76,148.39,207.53,152,200,152Z",
);
const packageIcon = /* @__PURE__ */ svgIcon(
	"package",
	"M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z",
);
const infoIcon = /* @__PURE__ */ svgIcon(
	"info",
	"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z",
);

export const HTML_ICONS: Record<keyof Required<RendererIcons>, string> = {
	hourglass: hourglassIcon,
	timer: timerIcon,
	thermometer: thermometerIcon,
	caretRight: caretRightIcon,
	arrowRight: arrowRightIcon,
	arrowUDownLeft: arrowUDownLeftIcon,
	arrowElbowDownRight: arrowElbowDownRightIcon,
	warning: warningIcon,
	pencilSimple: pencilSimpleIcon,
	minus: minusIcon,
	plus: plusIcon,
	clock: clockIcon,
	clockCounterClockwise: clockCounterClockwiseIcon,
	fire: fireIcon,
	knife: knifeIcon,
	scales: scalesIcon,
	package: packageIcon,
	info: infoIcon,
};

export const MD_ICONS: Record<keyof Required<RendererIcons>, string> = {
	hourglass: "⏳ ",
	timer: "⏲️ ",
	thermometer: "🔥",
	caretRight: "👉",
	arrowRight: "->&",
	arrowUDownLeft: "",
	arrowElbowDownRight: "↳ ",
	warning: " ⚠️",
	pencilSimple: "",
	minus: "-",
	plus: "+",
	clock: "⏱️ ",
	clockCounterClockwise: "🔄 ",
	fire: "🔥 ",
	knife: "🔪 ",
	scales: "⚖️ ",
	package: "📦 ",
	info: "ℹ️ ",
};

export const PRINT_ICONS: Record<keyof Required<RendererIcons>, string> = {
	hourglass: hourglassIcon,
	timer: timerIcon,
	thermometer: thermometerIcon,
	caretRight: "→",
	arrowRight: "→",
	arrowUDownLeft: "↵",
	arrowElbowDownRight: "↳",
	warning: "⚠",
	pencilSimple: "✎",
	clock: clockIcon,
	fire: "△",
	knife: "—",
	scales: "⚖",
	clockCounterClockwise: "↺",
	package: "📦",
	info: "ℹ",
	minus: "-",
	plus: "+",
};

export const DEFAULT_ICONS = {
	html: HTML_ICONS,
	md: MD_ICONS,
	print: PRINT_ICONS,
};
