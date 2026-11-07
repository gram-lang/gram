import { Box, Text, useInput } from "ink";
import { formatElapsed } from "../durations";

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
				Total time in the kitchen: <Text bold>{formatElapsed(elapsedMs)}</Text>
			</Text>
			<Text> </Text>
			<Text dimColor> [Q / Space] Quit</Text>
		</Box>
	);
}
