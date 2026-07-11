export interface ReadingCoachInput {
  ar: number;
  wpm: number;
  accuracy: number;
  comprehension: number;
}

export interface ReadingCoachResult {
  stage: string;
  diagnosis: string;
  goal: string;
  roadmap: string[];
  parentAction: string[];
}

export function generateReadingCoach(
  input: ReadingCoachInput
): ReadingCoachResult {

  const { ar, wpm, accuracy, comprehension } = input;

  //-----------------------------------
  // Stage
  //-----------------------------------

  let stage = "";

  if (ar < 1.5) stage = "Early Decoder";
  else if (ar < 2.5) stage = "Developing Reader";
  else if (ar < 3.5) stage = "Meaning Builder";
  else stage = "Independent Reader";

  //-----------------------------------
  // Diagnosis
  //-----------------------------------

  let diagnosis = "";

  if (wpm < 80) {

    diagnosis =
      "읽는 속도가 아직 느립니다. 쉬운 책을 반복해서 읽으며 자동화를 만드는 것이 가장 중요합니다.";

  } else if (accuracy < 90) {

    diagnosis =
      "속도는 충분하지만 정확도가 부족합니다. 단어를 끝까지 정확하게 읽는 연습이 필요합니다.";

  } else if (comprehension < 80) {

    diagnosis =
      "읽기는 안정적이지만 내용을 이해하는 힘이 부족합니다. 읽은 내용을 자신의 말로 설명하는 연습이 필요합니다.";

  } else {

    diagnosis =
      "읽기 속도와 정확도, 이해도가 모두 안정적인 수준입니다. 이제 조금 더 높은 난이도의 책으로 확장하면 됩니다.";

  }

  //-----------------------------------
  // Goal
  //-----------------------------------

  let goal = "";

  if (wpm < 80)
    goal = "매끄럽게 끊기지 않고 읽는 연습";

  else if (accuracy < 90)
    goal = "단어를 끝까지 정확하게 읽기";

  else if (comprehension < 80)
    goal = "읽은 내용을 자신의 말로 설명하기";

  else
    goal = "조금 더 어려운 책으로 읽기 확장하기";

  //-----------------------------------
  // Roadmap
  //-----------------------------------

  const roadmap: string[] = [];

  if (wpm < 80) {

    roadmap.push(
      "현재 AR 수준의 책을 하루 15분씩 소리 내어 읽기",
      "같은 책을 2~3회 반복 읽기",
      "목표 WPM 90 이상 달성",
      "다음 AR 단계 도전"
    );

  } else if (accuracy < 90) {

    roadmap.push(
      "천천히 정확하게 읽기",
      "틀린 단어 다시 읽기",
      "정확도 95% 이상 목표",
      "속도를 다시 높이기"
    );

  } else if (comprehension < 80) {

    roadmap.push(
      "문단마다 핵심 내용 말하기",
      "등장인물과 사건 정리하기",
      "질문에 자신의 말로 답하기",
      "이해도 85% 이상 목표"
    );

  } else {

    roadmap.push(
      "AR +0.3 수준 책 읽기",
      "다양한 장르 읽기",
      "긴 챕터북 도전",
      "독서량 꾸준히 늘리기"
    );

  }

  //-----------------------------------
  // Parent Action
  //-----------------------------------

  const parentAction: string[] = [];

  if (wpm < 80) {

    parentAction.push(
      "매일 15분 함께 읽어 주세요.",
      "속도를 재려고 하지 말고 끝까지 읽게 해 주세요.",
      "같은 책을 반복해서 읽는 것이 효과적입니다."
    );

  } else if (accuracy < 90) {

    parentAction.push(
      "틀린 단어를 지적하기보다 다시 읽게 해 주세요.",
      "천천히 정확하게 읽도록 격려해 주세요.",
      "속도보다 정확도를 먼저 만들어 주세요."
    );

  } else if (comprehension < 80) {

    parentAction.push(
      "다 읽은 뒤 내용을 한 문장으로 말하게 해 주세요.",
      "왜 그렇게 생각했는지 질문해 주세요.",
      "정답보다 설명하는 과정을 칭찬해 주세요."
    );

  } else {

    parentAction.push(
      "조금 더 어려운 책을 시도해 보세요.",
      "매일 꾸준히 읽는 습관을 유지해 주세요.",
      "독후 대화를 자주 해 주세요."
    );

  }

  return {
    stage,
    diagnosis,
    goal,
    roadmap,
    parentAction
  };

}