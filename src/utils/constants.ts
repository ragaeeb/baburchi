import type { MatchPolicy } from '@/types';

export const DEFAULT_POLICY: Required<MatchPolicy> = {
    enableFuzzy: true,
    maxEditAbs: 3,
    maxEditRel: 0.1,
    q: 4,
    gramsPerExcerpt: 5,
    maxCandidatesPerExcerpt: 40,
    seamLen: 512,
};
