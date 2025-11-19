import { sanitizeArabic } from './utils/sanitize';
import { areSimilarAfterNormalization, calculateSimilarity } from './utils/similarity';

/**
 * Aligns split text segments to match target lines by finding the best order.
 *
 * This function handles cases where text lines have been split into segments
 * and need to be merged back together in the correct order. It compares
 * different arrangements of the segments against target lines to find the
 * best match based on similarity scores.
 *
 * @param targetLines - Array where each element is either a string to align against, or falsy to skip alignment
 * @param segmentLines - Array of text segments that may represent split versions of target lines.
 * @returns Array of aligned text lines
 */
export const alignTextSegments = (targetLines: string[], segmentLines: string[]) => {
    const alignedLines: string[] = [];
    let segmentIndex = 0;

    for (const targetLine of targetLines) {
        if (segmentIndex >= segmentLines.length) {
            break;
        }

        if (targetLine) {
            // Process line that needs alignment
            const { result, segmentsConsumed } = processAlignmentTarget(targetLine, segmentLines, segmentIndex);

            if (result) {
                alignedLines.push(result);
            }
            segmentIndex += segmentsConsumed;
        } else {
            // For lines that don't need alignment, use one-to-one correspondence
            alignedLines.push(segmentLines[segmentIndex]);
            segmentIndex++;
        }
    }

    // Add any remaining segments that were not processed
    if (segmentIndex < segmentLines.length) {
        alignedLines.push(...segmentLines.slice(segmentIndex));
    }

    return alignedLines;
};

/**
 * Tries to merge two candidate segments in both possible orders and returns the best match.
 *
 * @param targetLine - The line we are trying to reconstruct.
 * @param partA - The first candidate segment to evaluate.
 * @param partB - The second candidate segment to evaluate.
 * @returns The merged segment that best matches the target line after normalization.
 */
const findBestSegmentMerge = (targetLine: string, partA: string, partB: string) => {
    const mergedForward = `${partA} ${partB}`;
    const mergedReversed = `${partB} ${partA}`;

    const normalizedTarget = sanitizeArabic(targetLine);
    const scoreForward = calculateSimilarity(normalizedTarget, sanitizeArabic(mergedForward));
    const scoreReversed = calculateSimilarity(normalizedTarget, sanitizeArabic(mergedReversed));

    return scoreForward >= scoreReversed ? mergedForward : mergedReversed;
};

/**
 * Processes a single target line that needs alignment.
 *
 * @param targetLine - The line we are attempting to align to.
 * @param segmentLines - The collection of available text segments.
 * @param segmentIndex - The current index within {@link segmentLines} to consider.
 * @returns An object containing the resulting aligned text and how many segments were consumed.
 */
const processAlignmentTarget = (targetLine: string, segmentLines: string[], segmentIndex: number) => {
    const currentSegment = segmentLines[segmentIndex];

    // First, check if the current segment is already a good match
    if (areSimilarAfterNormalization(targetLine, currentSegment)) {
        return { result: currentSegment, segmentsConsumed: 1 };
    }

    // If not a direct match, try to merge two segments
    const partA = segmentLines[segmentIndex];
    const partB = segmentLines[segmentIndex + 1];

    // Ensure we have two parts to merge
    if (!partA || !partB) {
        return partA ? { result: partA, segmentsConsumed: 1 } : { result: '', segmentsConsumed: 0 };
    }

    const bestMerge = findBestSegmentMerge(targetLine, partA, partB);
    return { result: bestMerge, segmentsConsumed: 2 };
};
