import { Box, Text, useInput } from "ink";

function fmtDuration(ms: number): string {
	const total = Math.round(ms / 60000);
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h > 0 && m > 0) return `${h}h ${m} min`;
	if (h > 0) return `${h}h`;
	return `${m} min`;
}

interface Props {
	title: string | null;
	elapsedMs: number;
	onQuit: () => void;
}

export default function EndScreen({ title, elapsedMs, onQuit }: Props) {
	useInput((input, key) => {
		if (
			input === "q" ||
			input === "Q" ||
			key.escape ||
			key.return ||
			input === " "
		) {
			onQuit();
		}
	});

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1}>
			<Text bold color="green">
				✓ Done!
			</Text>
			<Text> </Text>
			{title && <Text bold>{title}</Text>}
			<Text>
				{" "}
				Total time in the kitchen: <Text bold>{fmtDuration(elapsedMs)}</Text>
			</Text>
			<Text> </Text>
			<Text dimColor> [Q / Space] Quit</Text>
		</Box>
	);
}
