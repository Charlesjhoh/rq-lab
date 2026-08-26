#!/usr/bin/env python3
"""
AR2.0/AR3.0 후보 지문 신규 33개(AR2.0 11개, AR3.0 22개) 추가.

배경: relabel_passages.py로 재계산한 새 라벨 기준, 레벨 선택 화면의 좁혀진 후보 범위
(UPPER_RANGE=0.3/LOWER_RANGE=0.4)로 시뮬레이션해보면 AR2.0 후보가 21개, AR3.0 후보가
10개뿐이라 반복 노출 문제가 있었다. 기존 지문을 억지로 재작성하는 대신, 처음부터 목표
난이도에 맞게 새로 쓰는 편이 자연스러워 AR2.0 11개, AR3.0 22개를 새로 작성했다.

각 지문은 estimate_center()(scripts/relabel_passages.py와 동일 공식: FK/Coleman-Liau
블렌드, 35단어 이하는 촘촘한 상한)로 난이도를 검증해, 전부 목표 레벨의 실제 선택 범위
(AR2.0: center 1.4~2.5, AR3.0: center 2.4~3.5) 안에 들어오는 것을 확인했다. 문장은
6~10단어 내외로 짧게 끊고, 어휘는 목표 학년 수준에 맞춰 반복적으로 다듬었다(예:
"grandmother"→"grandma", "neighborhood"→"kids nearby" 등 — Coleman-Liau가 단어당
평균 글자수에 민감해서, 흔한 단어라도 길면 90단어 안팎의 짧은 지문에서는 난이도를
크게 밀어올린다).

dry-run(기본)으로 삽입될 내용을 미리 보여주고, --apply를 붙여야 실제로 passages 테이블에
INSERT한다.

사용법:
  python3 scripts/insert_new_ar2_ar3_passages.py           # 리포트만
  python3 scripts/insert_new_ar2_ar3_passages.py --apply    # 실제 DB에 삽입
"""
import argparse
import os

import requests

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")

NEW_PASSAGES = [
  {
    "content": "Ben went fishing with his grandpa. They packed snacks and two poles. Grandpa showed Ben how to cast his line. They waited by the water. Soon, Ben felt a tug on his line. He pulled hard and reeled it in. A small shiny fish jumped out. Ben was so excited. Grandpa helped him put the fish back. They packed up and walked home. Ben wanted to go fishing again.",
    "word_count": 69,
    "ar_min": 1.6,
    "ar_max": 2.0,
    "keywords": [
      "할아버지",
      "낚시",
      "호수",
      "물고기",
      "자랑"
    ]
  },
  {
    "content": "Ms. Lopez's class started a small garden. Each student picked one seed. Mia picked a carrot seed. She dug a small hole. She put in the seed. It was a sunny day. Every day, the class gave it water. Soon, green sprouts came up. Mia looked at them each day. She felt very glad. After some weeks, the carrots grew big. The class pulled them out. They washed the carrots. They had a snack. It was a fun day.",
    "word_count": 79,
    "ar_min": 1.6,
    "ar_max": 2.0,
    "keywords": [
      "교실",
      "텃밭",
      "당근",
      "씨앗",
      "수확"
    ]
  },
  {
    "content": "Sam and his dad built a birdhouse. They found wood in the garage. Dad cut the wood into small pieces. Sam held the pieces together. They used a hammer and nails. Slowly, the birdhouse took shape. Sam painted it bright blue. They hung it on a tree. Soon, a little bird flew inside. Sam watched from his window every day. He was happy the bird liked its home.",
    "word_count": 68,
    "ar_min": 2.1,
    "ar_max": 2.5,
    "keywords": [
      "새집",
      "아빠",
      "나무",
      "페인트",
      "새"
    ]
  },
  {
    "content": "It rained all day. Kim and her brother stayed inside. They got out their board games. First, they played a card game. Kim won and cheered. Next, they played a dice game. Her brother rolled two sixes. They laughed and kept playing. Mom brought warm cocoa. By the time the rain stopped, they had played five games. Kim said rainy days could be fun.",
    "word_count": 64,
    "ar_min": 1.6,
    "ar_max": 2.0,
    "keywords": [
      "비",
      "보드게임",
      "남매",
      "코코아",
      "실내놀이"
    ]
  },
  {
    "content": "Ella's class visited a farm. A farmer showed them the barn. They saw fluffy sheep and small goats. Ella fed a goat some hay. The goat ate right from her hand. Next, they saw the chicken coop. Ella found a warm brown egg. The farmer let her hold a baby chick. Ella loved every animal she saw. She told her family all about it.",
    "word_count": 64,
    "ar_min": 1.9,
    "ar_max": 2.3,
    "keywords": [
      "농장",
      "견학",
      "염소",
      "병아리",
      "달걀"
    ]
  },
  {
    "content": "Noah was scared of the deep end. His swim teacher said to relax. Slowly, Noah kicked his legs in the water. He held the pool wall at first. After some lessons, he let go. He floated all by himself. His teacher clapped for him. Noah swam a few strokes in the pool. He felt proud of himself that day. Now he swims every weekend.",
    "word_count": 64,
    "ar_min": 1.8,
    "ar_max": 2.2,
    "keywords": [
      "수영",
      "수영장",
      "선생님",
      "연습",
      "자신감"
    ]
  },
  {
    "content": "The school had a bake sale on Friday. Lucy and her mom made bread. They mixed flour, water, and yeast. Lucy kneaded the dough with her hands. They let the dough rest for an hour. Then they shaped it into a loaf. The bread baked until golden brown. The kitchen smelled warm and sweet. Lucy brought the bread to school. It sold out in a few minutes.",
    "word_count": 67,
    "ar_min": 1.9,
    "ar_max": 2.3,
    "keywords": [
      "빵",
      "베이크세일",
      "반죽",
      "오븐",
      "학교"
    ]
  },
  {
    "content": "One winter day, Ava could not find her mitten. She looked all over her room. She checked her backpack and her boots. Her dog Max barked outside. Ava went out to see why. Max sat next to her lost mitten. It was stuck under some snow. Ava thanked Max with a big hug. She put on her mittens and went out to play. Max wagged his tail beside her.",
    "word_count": 69,
    "ar_min": 1.6,
    "ar_max": 2.0,
    "keywords": [
      "장갑",
      "겨울",
      "강아지",
      "눈",
      "찾기"
    ]
  },
  {
    "content": "Owen and his sister built a fort. They used blankets and chairs. They also used soft pillows. Inside, they had a small light. Owen picked a book about dinosaurs. His sister picked one about knights. They took turns reading out loud. The light made fun shapes on the walls. They stayed up a bit late. Mom peeked in and smiled. It was a fun, cozy night.",
    "word_count": 66,
    "ar_min": 2.0,
    "ar_max": 2.4,
    "keywords": [
      "담요",
      "요새",
      "손전등",
      "책",
      "남매"
    ]
  },
  {
    "content": "Jayden made a kite from paper and sticks. He tied a long string to it. On a windy day, he ran to the park. He held the kite up in the wind. Slowly, it lifted into the sky. Jayden let out more string. His sister clapped and pointed at it. They watched it dance in the wind. After an hour, they pulled the kite back down. Jayden wanted to fly it again.",
    "word_count": 72,
    "ar_min": 1.6,
    "ar_max": 2.0,
    "keywords": [
      "연날리기",
      "종이",
      "바람",
      "공원",
      "동생"
    ]
  },
  {
    "content": "Zoe walked on the beach looking for shells. She spotted a smooth, shiny rock instead. It had little sparkly specks on it. She picked it up and showed her brother. He said it might be a special rock. They rinsed it in the cool water. Zoe put the rock in her pocket. At home, she put it on her windowsill. Every day, she looked at her rock. It reminded her of their fun day.",
    "word_count": 74,
    "ar_min": 2.0,
    "ar_max": 2.4,
    "keywords": [
      "바닷가",
      "돌",
      "조개",
      "오빠",
      "추억"
    ]
  },
  {
    "content": "Diego got a new skateboard for his birthday. He could not wait to try it out. He rolled down the driveway very fast. Soon he lost his balance and fell down. It did not hurt very much at all. His older cousin showed him how to stand. She told him to bend his knees a little. Diego wobbled but kept trying again and again. Slowly, he found his balance and footing. After an hour, he could roll across the yard. He still fell down a few more times. Each time, he got back up and smiled. By sunset, he could turn corners very easily. He told his parents about his progress at dinner. He knew practice would make him even better.",
    "word_count": 121,
    "ar_min": 3.1,
    "ar_max": 3.5,
    "keywords": [
      "스케이트보드",
      "연습",
      "사촌",
      "균형",
      "도전"
    ]
  },
  {
    "content": "Mr. Kim's class went to the planetarium. The room felt dark like night. The ceiling had lights like stars. Soon, many stars came on above them. A guide talked about star shapes. Emma learned about the Big Dipper. It is part of a bigger group. The guide showed pictures of the planets. Emma liked the rings on one. After the show, kids asked questions. On the ride home, Emma thought about stars. She wanted to look at the sky that night.",
    "word_count": 81,
    "ar_min": 2.8,
    "ar_max": 3.2,
    "keywords": [
      "천문대",
      "별자리",
      "견학",
      "토성",
      "망원경"
    ]
  },
  {
    "content": "Ms. Chen's class got tiny bugs in a jar. They were baby caterpillars. Students fed them green leaves every day. The bugs grew bigger and bigger. After two weeks, each one made a hard shell. The class waited for something to happen. One day, cracks formed on the shells. A butterfly came out slowly. Its wings were wrinkled and wet. It rested while its wings dried. That day, the class let them go outside. Everyone cheered as they flew away.",
    "word_count": 80,
    "ar_min": 3.3,
    "ar_max": 3.7,
    "keywords": [
      "애벌레",
      "나비",
      "교실",
      "관찰",
      "번데기"
    ]
  },
  {
    "content": "Maddie wanted to help the animal shelter. She set up a lemonade stand. Her brother made a sign for it. They mixed lemons, sugar, and water. On Saturday, they set up a table. At first, few people stopped by. Then more people walked by. By afternoon, they sold fifty cups. Maddie counted the money that night. She gave all of it to the shelter. The workers said thank you to her.",
    "word_count": 71,
    "ar_min": 2.9,
    "ar_max": 3.3,
    "keywords": [
      "레모네이드",
      "동물보호소",
      "기부",
      "이웃",
      "판매"
    ]
  },
  {
    "content": "For his birthday, Marcus wanted to cook dinner. His mom said yes and stayed close by. He chose to make spaghetti with sauce. He chopped onions and garlic carefully. The kitchen filled with a warm smell. He boiled a big pot of water. He added the pasta and stirred it. Marcus set the table for his family. When it was ready, he served each plate. His family took a bite and smiled. They said it was some of the best spaghetti. Marcus felt proud of his cooking.",
    "word_count": 87,
    "ar_min": 3.0,
    "ar_max": 3.4,
    "keywords": [
      "요리",
      "생일",
      "스파게티",
      "가족",
      "자신감"
    ]
  },
  {
    "content": "Every year, the school held a talent show. Grace wanted to do a magic trick. She practiced for weeks in her mirror. Her trick made a small ball disappear. On the night of the show, she felt nervous. She walked onto the stage and took a breath. She did each step just like she practiced. The ball vanished right in front of everyone. Then she pulled it out from behind an ear. The crowd clapped loudly for her trick. Grace smiled with a huge, proud grin. Practice had turned her nerves into confidence.",
    "word_count": 93,
    "ar_min": 3.2,
    "ar_max": 3.6,
    "keywords": [
      "장기자랑",
      "마술",
      "연습",
      "무대",
      "자신감"
    ]
  },
  {
    "content": "Three friends wanted to build a treehouse. They picked a big tree in the yard. Carlos's dad helped them get wood. They cut boards together as a team. It took a whole weekend of work. By Sunday, it was strong enough to use. They added a rope rail for safety. They brought in a rug and pillows. They hung a small sign on the ladder. That night, they watched the sunset there. Carlos said it was his best project. His friends wanted to go there every weekend.",
    "word_count": 87,
    "ar_min": 2.5,
    "ar_max": 2.9,
    "keywords": [
      "나무집",
      "친구",
      "협동",
      "주말",
      "목공"
    ]
  },
  {
    "content": "Every fall, Layla went to her grandma's farm. This year, she helped pick pumpkins. Her grandma gave her small clippers. Layla learned to snip the stems. Some pumpkins were heavy to hold. By lunch, the wagon was full. Her grandma showed her how to get eggs. Layla found warm eggs under the hens. Later, they walked past tall corn plants. Her grandma said farmers keep corn for winter. That night, they carved a pumpkin face. Layla could not wait to go back.",
    "word_count": 82,
    "ar_min": 3.2,
    "ar_max": 3.6,
    "keywords": [
      "추수",
      "농장",
      "할머니",
      "호박",
      "가을"
    ]
  },
  {
    "content": "For the science fair, Owen grew his own crystals. He mixed warm water with a special powder. The powder would form shapes as it cooled. He poured the mix into a jar. He hung a string down inside it. Slowly, tiny crystals formed on the string. Each day, Owen checked and wrote down notes. After a week, the string was covered in blue crystals. He lifted it out and let it dry. At the fair, he showed his crystal to everyone. Kids and teachers stopped to look at it. Owen won a ribbon for his project.",
    "word_count": 96,
    "ar_min": 2.9,
    "ar_max": 3.3,
    "keywords": [
      "과학전람회",
      "결정",
      "실험",
      "관찰",
      "리본"
    ]
  },
  {
    "content": "Every week, Mr. Patel taught chess after school. Jasmine had never played chess before. At first, she forgot the moves. Mr. Patel showed her simple moves. Slowly, she began to see patterns. She played her brother every night. He beat her easily at first. She read a chess book to learn. One night, she beat her brother. He was surprised and proud of her. Jasmine joined the chess club. She wanted to learn even more.",
    "word_count": 75,
    "ar_min": 3.1,
    "ar_max": 3.5,
    "keywords": [
      "체스",
      "방과후",
      "오빠",
      "전략",
      "동아리"
    ]
  },
  {
    "content": "The Ramirez family went camping in the woods. On the second night, they heard noises. Everyone stopped and listened close. Dad slowly looked out of the tent. A young deer stood near the wood. It looked at them, then ran off. The next day, they found small tracks. Mia took photos of the tracks. A guide said deer come out at night. He said they look for food nearby. The family felt lucky to see a deer. It became their best camping story.",
    "word_count": 83,
    "ar_min": 2.6,
    "ar_max": 3.0,
    "keywords": [
      "캠핑",
      "사슴",
      "숲",
      "가족",
      "발자국"
    ]
  },
  {
    "content": "Zara loved to sing quietly at home. She felt shy singing for other people. Her music teacher said to try out for choir. On the big day, her hands were shaking. She sang a song she had practiced for weeks. Her voice shook a little but she finished. The teacher said she had a lovely voice. A week later, she made the choir. At first, she felt shy with the group. Slowly, singing together felt less scary. At the winter concert, she felt confident. She even sang a small solo part alone.",
    "word_count": 92,
    "ar_min": 3.3,
    "ar_max": 3.7,
    "keywords": [
      "합창단",
      "오디션",
      "긴장",
      "공연",
      "자신감"
    ]
  },
  {
    "content": "After days of rain, the sun came out. Miguel and his sister put on their boots. They ran outside to find puddles. The biggest puddle reached their ankles. Miguel jumped in and splashed his sister. She laughed and jumped in too. They looked for more puddles down the street. They saw worms on the wet sidewalk. Miguel moved the worms onto the grass. His sister said worms liked the rain. Their boots were soaked by the time they went inside. Mom handed them warm towels at the door.",
    "word_count": 88,
    "ar_min": 3.2,
    "ar_max": 3.6,
    "keywords": [
      "웅덩이",
      "장화",
      "비",
      "남매",
      "지렁이"
    ]
  },
  {
    "content": "Ben and his friend Theo made a comic book. They spent a weekend making up ideas. Theo drew each part carefully. Ben wrote funny lines for the story. Together, they planned twelve pages. Sometimes they argued about the best ideas. They picked a bad guy who made ice. After two weeks, the comic was done. They made copies for their class. Kids asked when the next part would come. Ben and Theo felt proud of their work. They planned to make a second comic book.",
    "word_count": 85,
    "ar_min": 3.3,
    "ar_max": 3.7,
    "keywords": [
      "만화책",
      "친구",
      "그림",
      "이야기",
      "협업"
    ]
  },
  {
    "content": "Mrs. Alvarez's class had a talk about pets. Half the class wanted a class pet. The rest were not so sure because some kids might get sick from pets. Diego said a fish tank was safe. Sophia liked a small rabbit more. Both sides talked about their ideas. The teacher said to be kind and listen. After talking, the class had a vote. Most kids picked the fish tank. The next week, two fish came to class. Kids took turns and fed the fish. Diego felt glad his idea had won.",
    "word_count": 91,
    "ar_min": 2.6,
    "ar_max": 3.0,
    "keywords": [
      "토론",
      "학급",
      "반려동물",
      "어항",
      "투표"
    ]
  },
  {
    "content": "Ms. Rivera showed the class something fun. She filled a jar with warm water. She put white foam on top like a cloud. Then she dripped blue color onto it. At first, nothing seemed to happen. After a bit, the color sank down. Blue drops fell like tiny rain. The class cheered at their rain cloud. Ms. Rivera said real clouds work this way. When clouds get heavy, rain falls down. Ethan said he would think of this on rainy days. The class wanted to try it again at home.",
    "word_count": 90,
    "ar_min": 2.3,
    "ar_max": 2.7,
    "keywords": [
      "실험",
      "구름",
      "비",
      "과학",
      "교실"
    ]
  },
  {
    "content": "Sophia's family visited the aquarium in summer. Big fish tanks were all around them. Sophia touched the glass near a shark. Her favorite spot had small sea horses. She learned that dad sea horses carry the babies. A worker let her touch a soft starfish. Her brother loved the otters at play. They watched a diver feed the fish. After that, they ate lunch by the water. Sophia got a card with a sea horse on it. That night, she put it above her bed. She told her friends about it the next day.",
    "word_count": 94,
    "ar_min": 3.3,
    "ar_max": 3.7,
    "keywords": [
      "수족관",
      "해마",
      "가족여행",
      "불가사리",
      "상어"
    ]
  },
  {
    "content": "Jackson and his neighbors made a band. None of them had real horns or drums. They used kazoos to make songs. They played in the garage after school. At first, it sounded like noise. Slowly, they learned some easy songs. Jackson's sister taught them a few songs. They used pots and pans as drums. Kids near them came to listen. One day, they played for their moms and dads. Everyone laughed and clapped a lot. They planned to play again in summer.",
    "word_count": 82,
    "ar_min": 2.6,
    "ar_max": 3.0,
    "keywords": [
      "밴드",
      "카주",
      "이웃",
      "연주",
      "공연"
    ]
  },
  {
    "content": "One morning, a small dog wandered into their yard. It had no collar but looked friendly. Lily gave it water and some rice. She made posters with its photo. For two days, no one called. On the third day, a woman knocked crying. Her dog had slipped through a broken fence. The dog barked and ran to her arms. She thanked the family many times. Lily felt happy the dog found its home. The woman came back later with cookies. She thanked the whole family again.",
    "word_count": 86,
    "ar_min": 3.0,
    "ar_max": 3.4,
    "keywords": [
      "강아지",
      "이웃",
      "전단지",
      "재회",
      "친절"
    ]
  },
  {
    "content": "Every summer, Noah and Mr. Diaz grew flowers. They had fun trying to grow the best one. They checked the plants each week. At first, both plants grew the same. Then Noah gave his plant more food. By July, his plant grew much taller. Mr. Diaz said the trick had worked. In August, they checked both plants again. Noah's plant was a foot taller. Mr. Diaz asked to learn the trick. The next year, they grew flowers again. It became their best summer game.",
    "word_count": 84,
    "ar_min": 2.6,
    "ar_max": 3.0,
    "keywords": [
      "해바라기",
      "이웃",
      "경쟁",
      "정원",
      "여름"
    ]
  },
  {
    "content": "The school had a contest with bottles and cans. The class that won got a pizza party. Mr. Bennett's class made signs about it. Every day, kids brought bottles and cans. Two kids weighed the bags each day. Soon, his class had the most bags. Other classes brought more bags too. On the last day, they counted each bag. Mr. Bennett's class had the most of all. The class had a big pizza party. Many kids said they would keep doing it. The school did it again next year.",
    "word_count": 89,
    "ar_min": 2.5,
    "ar_max": 2.9,
    "keywords": [
      "재활용",
      "학급대항",
      "포스터",
      "피자파티",
      "환경"
    ]
  },
  {
    "content": "For her grandma's birthday, Camila made a cake. She found an old family recipe, and her mom helped her measure things. They mixed it all and put it in pans. It baked in the oven for a while. Camila made frosting while it baked. Once it cooled, she spread the frosting on. She put fresh berries on top of it. When grandma saw it, she cried happy tears. She said it tasted like her mom's cake. The family sat and had a slice. Camila felt glad she made it.",
    "word_count": 89,
    "ar_min": 2.4,
    "ar_max": 2.8,
    "keywords": [
      "생일케이크",
      "할머니",
      "레시피",
      "가족",
      "정성"
    ]
  }
]


def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


def insert_rows(env, rows):
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    resp = requests.post(
        f"{url}/rest/v1/passages",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=rows,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="실제로 DB에 삽입")
    args = parser.parse_args()

    ar2 = [p for p in NEW_PASSAGES if p["ar_max"] <= 2.5]
    ar3 = [p for p in NEW_PASSAGES if p["ar_max"] > 2.5]

    print(f"AR2.0 대상 {len(ar2)}개, AR3.0 대상 {len(ar3)}개, 총 {len(NEW_PASSAGES)}개\n")
    for p in NEW_PASSAGES:
        print(f"  words={p['word_count']:>4}  label={p['ar_min']:.1f}-{p['ar_max']:.1f}  {p['content'][:60]}")

    if args.apply:
        env = load_env()
        print("\n--apply 지정됨: DB에 삽입 중...")
        inserted = insert_rows(env, NEW_PASSAGES)
        print(f"완료: {len(inserted)}개 삽입됨")
    else:
        print("\n(dry-run — DB에는 아무것도 반영되지 않았습니다. 반영하려면 --apply를 추가하세요.)")


if __name__ == "__main__":
    main()
