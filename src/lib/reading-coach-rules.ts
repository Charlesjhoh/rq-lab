// lib/reading-coach-rules.ts

export interface ReadingCoachRule {
  id: string;

  priority: number;

  stage: string;

  title: string;

  match: {
    comprehensionMax?: number;
    comprehensionMin?: number;

    accuracyMax?: number;
    accuracyMin?: number;

    wpmMax?: number;
    wpmMin?: number;

    wrongWordsMin?: number;
    badPronunciationMin?: number;
  };

  issue: string;

  cause: string;

  roadmapId: string;
}

export const ReadingCoachRules: ReadingCoachRule[] = [

  //------------------------------------------------------
  // 이해도 부족 + 속도 충분
  //------------------------------------------------------

  {
    id: "meaning_fast",

    priority: 100,

    stage: "Meaning Builder",

    title: "이해도를 먼저 높여야 합니다.",

    match: {
      comprehensionMax: 79,
      wpmMin: 100,
    },

    issue: "LOW_COMPREHENSION",

    cause: "FAST_WITHOUT_MEANING",

    roadmapId: "meaning_builder",
  },

  //------------------------------------------------------
  // 이해도 부족 + 속도 부족
  //------------------------------------------------------

  {
    id: "meaning_slow",

    priority: 90,

    stage: "Meaning Builder",

    title: "읽기 경험을 먼저 늘려야 합니다.",

    match: {
      comprehensionMax: 79,
      wpmMax: 99,
    },

    issue: "LOW_COMPREHENSION",

    cause: "INSUFFICIENT_READING_EXPERIENCE",

    roadmapId: "easy_repeat",
  },

  //------------------------------------------------------
  // 정확도 부족
  //------------------------------------------------------

  {
    id: "accuracy",

    priority: 80,

    stage: "Word Decoder",

    title: "정확도를 먼저 높여야 합니다.",

    match: {
      accuracyMax: 94,
    },

    issue: "LOW_ACCURACY",

    cause: "WORD_RECOGNITION",

    roadmapId: "accuracy",
  },

  //------------------------------------------------------
  // 읽기 속도 부족
  //------------------------------------------------------

  {
    id: "fluency",

    priority: 70,

    stage: "Fluency Builder",

    title: "읽기 속도를 높여야 합니다.",

    match: {
      wpmMax: 79,
      accuracyMin: 95,
      comprehensionMin: 80,
    },

    issue: "LOW_FLUENCY",

    cause: "INSUFFICIENT_FLUENCY",

    roadmapId: "fluency",
  },

  //------------------------------------------------------
  // 읽기 오류 많음
  //------------------------------------------------------

  {
    id: "wrong_words",

    priority: 95,

    stage: "Word Decoder",

    title: "단어를 정확히 읽는 습관이 필요합니다.",

    match: {
      wrongWordsMin: 6,
    },

    issue: "READING_ERRORS",

    cause: "SKIPPING_OR_SUBSTITUTION",

    roadmapId: "accuracy",
  },

  //------------------------------------------------------
  // 발음 오류 많음
  //------------------------------------------------------

  {
    id: "pronunciation",

    priority: 60,

    stage: "Pronunciation Builder",

    title: "발음을 조금 더 정확하게 다듬으면 좋겠습니다.",

    match: {
      badPronunciationMin: 4,
    },

    issue: "PRONUNCIATION",

    cause: "PHONICS",

    roadmapId: "pronunciation",
  },

  //------------------------------------------------------
  // 안정적인 읽기
  //------------------------------------------------------

  {
    id: "independent",

    priority: 1,

    stage: "Independent Reader",

    title: "안정적인 읽기 단계입니다.",

    match: {},

    issue: "BALANCED_READER",

    cause: "NONE",

    roadmapId: "challenge",
  },

];