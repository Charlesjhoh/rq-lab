// lib/roadmap-templates.ts

export interface RoadmapTemplate {
  id: string;

  title: string;

  goal: string;

  duration: string;

  weeklyPlan: string[];

  parentActions: string[];

  retest: string;
}

export const Roadmaps: Record<string, RoadmapTemplate> = {

  //==================================================
  // Meaning Builder
  //==================================================

  meaning_builder: {

    id: "meaning_builder",

    title: "Meaning Builder",

    goal:
      "내용을 이해하며 읽는 습관 만들기",

    duration:
      "4 Weeks",

    weeklyPlan: [

      "현재 AR 수준의 책을 하루 20분씩 꾸준히 읽기",

      "읽은 내용을 한국어로 설명하기",

      "같은 수준의 다양한 책 읽기",

      "Reading Assessment 재테스트",

    ],

    parentActions: [

      "읽은 후 내용을 먼저 이야기하게 해 주세요.",

      "모르는 단어보다 이야기의 흐름을 먼저 확인해 주세요.",

      "틀린 답을 바로 알려주기보다 다시 생각하게 해 주세요.",

    ],

    retest:
      "4주 후 Reading Assessment",

  },

  //==================================================
  // Accuracy
  //==================================================

  accuracy: {

    id: "accuracy",

    title: "Word Decoder",

    goal:
      "단어를 정확하게 읽는 습관 만들기",

    duration:
      "4 Weeks",

    weeklyPlan: [

      "천천히 정확하게 읽기",

      "틀린 단어 반복 읽기",

      "문장 단위 반복 읽기",

      "Reading Assessment 재테스트",

    ],

    parentActions: [

      "속도보다 정확성을 칭찬해 주세요.",

      "틀린 단어를 다시 읽게 해 주세요.",

      "반복 읽기를 꾸준히 해 주세요.",

    ],

    retest:
      "4주 후 Reading Assessment",

  },

  //==================================================
  // Fluency
  //==================================================

  fluency: {

    id: "fluency",

    title: "Fluency Builder",

    goal:
      "자연스러운 읽기 속도 만들기",

    duration:
      "4 Weeks",

    weeklyPlan: [

      "같은 책 반복 읽기",

      "시간을 재지 않고 자연스럽게 읽기",

      "조금 긴 글 읽기",

      "Reading Assessment 재테스트",

    ],

    parentActions: [

      "속도를 강요하지 마세요.",

      "매일 20분 읽는 습관을 유지하세요.",

      "반복 읽기를 충분히 하세요.",

    ],

    retest:
      "4주 후 Reading Assessment",

  },

  //==================================================
  // Pronunciation
  //==================================================

  pronunciation: {

    id: "pronunciation",

    title: "Pronunciation Builder",

    goal:
      "정확한 발음 습관 만들기",

    duration:
      "4 Weeks",

    weeklyPlan: [

      "틀린 단어 다시 읽기",

      "원어민 음성을 듣고 따라 읽기",

      "문장 단위 따라 읽기",

      "Reading Assessment 재테스트",

    ],

    parentActions: [

      "틀린 단어를 크게 소리 내어 읽게 해 주세요.",

      "원어민 음성을 충분히 들려 주세요.",

    ],

    retest:
      "4주 후 Reading Assessment",

  },

  //==================================================
  // Challenge
  //==================================================

  challenge: {

    id: "challenge",

    title: "Independent Reader",

    goal:
      "조금 더 높은 수준의 책에 도전하기",

    duration:
      "4 Weeks",

    weeklyPlan: [

      "현재 수준의 다양한 책 읽기",

      "조금 긴 책 도전하기",

      "다양한 장르 읽기",

      "Reading Assessment 재테스트",

    ],

    parentActions: [

      "다양한 장르의 책을 읽게 해 주세요.",

      "꾸준한 독서 습관을 유지해 주세요.",

    ],

    retest:
      "4주 후 Reading Assessment",

  },

};