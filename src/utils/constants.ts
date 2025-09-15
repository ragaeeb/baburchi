import type { MatchPolicy } from '@/types';

export const DEFAULT_POLICY: Required<MatchPolicy> = {
    enableFuzzy: true,
    gramsPerExcerpt: 5,
    log: () => {},
    maxCandidatesPerExcerpt: 40,
    maxEditAbs: 3,
    maxEditRel: 0.1,
    q: 4,
    seamLen: 512,
};
