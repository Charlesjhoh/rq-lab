#!/usr/bin/env python3
"""
AR4.0 천장 바로 위(center 4.3~5.5)에 있어 1.0~4.0 어느 레벨에서도 후보로 안 뽑히던 39개
지문(중복 텍스트 포함 31개 고유 텍스트)을, 같은 줄거리를 유지한 채 문장을 짧게 끊고 어휘를
단순화해 다시 쓴 버전으로 교체한다.

배경: scripts/relabel_passages.py로 재계산해보니 passages 252개 중 152개(60%)가 선택 화면의
어느 레벨(1.0~4.0)에서도 후보로 안 뽑혔다. 그중 39개(center 4.3~5.5, "AR4.0 천장 바로 위")만
이번에 손보고, 나머지(center 5.5 이상, 대부분 중등~대학 수준 어휘)는 별도 재작성 작업이
필요해 이번 범위에서 제외했다.

원본과 동일한 주제/이야기를 유지한 채 문장을 짧게 끊고(FK의 "문장당 단어수" 항 낮춤), 다음절
어휘(예: determined→wanted, elderly→old, navigate→find a way through)를 쉬운 단어로 바꿔
(CLI의 "단어당 글자수" 항 낮춤) 다시 계산했다. 주제 자체가 요구하는 고유명사(meteorite,
telescope 등)는 그대로 두었다.

dry-run(기본)으로 변경 전후 비교 리포트를 출력하고, --apply를 붙여야 실제로 passages.content/word_count/ar_min/ar_max를
PATCH한다.

사용법:
  python3 scripts/apply_ar4_boundary_rewrites.py           # 리포트만
  python3 scripts/apply_ar4_boundary_rewrites.py --apply    # 실제 DB 반영
"""
import argparse
import os
import sys

import requests

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")

PATCHES = {
  "2755d3f3-791d-467b-813e-2e3a89969c3b": {
    "content": "Lucas spent the morning building a big sandcastle at the beach. He used a plastic bucket to make tall towers. Then he dug a deep ditch around the walls. He wanted it to look like a real castle. He put shiny seashells and green seaweed on the towers. Soon the ocean waves came closer. Lucas quickly built a high wall of sand. He wanted to protect his castle.",
    "word_count": 68,
    "ar_min": 3.9,
    "ar_max": 4.3
  },
  "57fece8c-fa7e-4f93-b56c-81d712955336": {
    "content": "Lucas spent the morning building a big sandcastle at the beach. He used a plastic bucket to make tall towers. Then he dug a deep ditch around the walls. He wanted it to look like a real castle. He put shiny seashells and green seaweed on the towers. Soon the ocean waves came closer. Lucas quickly built a high wall of sand. He wanted to protect his castle.",
    "word_count": 68,
    "ar_min": 3.9,
    "ar_max": 4.3
  },
  "d3bc3f73-7cf2-4069-8c92-c3559d878063": {
    "content": "Lucas spent the morning building a big sandcastle at the beach. He used a plastic bucket to make tall towers. Then he dug a deep ditch around the walls. He wanted it to look like a real castle. He put shiny seashells and green seaweed on the towers. Soon the ocean waves came closer. Lucas quickly built a high wall of sand. He wanted to protect his castle.",
    "word_count": 68,
    "ar_min": 3.9,
    "ar_max": 4.3
  },
  "3d4e7011-08c4-43a4-8aa6-17224d0e7614": {
    "content": "Sam could not find his library book about dinosaurs. The book was due tomorrow. He looked all over his room. He looked under his bed. He checked his bookshelf. He looked inside his backpack too. Then he remembered something. He had left the book on the kitchen table. Sam smiled and felt relieved. He put the book safely in his bag.",
    "word_count": 61,
    "ar_min": 3.1,
    "ar_max": 3.5
  },
  "6b0e8454-9df1-42d0-9770-cf6103f26cc8": {
    "content": "Sam could not find his library book about dinosaurs. The book was due tomorrow. He looked all over his room. He looked under his bed. He checked his bookshelf. He looked inside his backpack too. Then he remembered something. He had left the book on the kitchen table. Sam smiled and felt relieved. He put the book safely in his bag.",
    "word_count": 61,
    "ar_min": 3.1,
    "ar_max": 3.5
  },
  "7c640b0b-df9b-4d76-8a57-1d017147275f": {
    "content": "Mason wanted to ride his bike to the park. But he could not unlock it. His key was missing. He checked his jacket pockets. He looked under his bed. He looked behind the sofa too. He began to worry. Then his little sister walked in. She held up a shiny silver key. She had found it on the hall rug. She handed it to him with a smile.",
    "word_count": 68,
    "ar_min": 1.6,
    "ar_max": 2.0
  },
  "9ddd1b5a-0926-4e1f-b021-42d11c2a1c65": {
    "content": "Chloe worked hard for two weeks. She was getting ready for the school science fair. She made a model volcano. She used clay, red paint, and baking soda. On the day of the fair, judges came to her table. Chloe showed them how her volcano could erupt. Foamy bubbles poured out of the top. She was so happy. She won a blue ribbon for her hard work.",
    "word_count": 67,
    "ar_min": 2.7,
    "ar_max": 3.1
  },
  "add06960-0bf6-4438-b0d3-754be05e5096": {
    "content": "Sara has a blue backpack. She carries it to school every day. Inside the bag, she keeps her books and pencils. Today, she has a math test. She feels a little worried. Her teacher smiles and tells the class to begin. Sara reads the first question. She writes the answer. After the test, she feels better. At lunch, she sits with her friends. They talk about games. One friend likes soccer. Another friend likes drawing. Sara likes reading books. When school ends, she walks home with a happy face.",
    "word_count": 89,
    "ar_min": 3.0,
    "ar_max": 3.4
  },
  "f1b09686-e0a4-4857-90f9-6eb714bcd648": {
    "content": "One fall morning, Chloe and her family drove to an apple farm. The trees were full of red apples. Some apples hung low, close to the ground. Chloe held a big basket. She reached up to pick the best apples. Soon the basket was full. Chloe and her family sat on a bench. They drank cold apple juice together. They enjoyed the cool wind.",
    "word_count": 64,
    "ar_min": 2.8,
    "ar_max": 3.2
  },
  "06d04ffe-2609-4916-b459-7c2694d59e63": {
    "content": "On a cold Saturday, Jake and his grandma made cookies. Jake put flour, sugar, and butter into a big bowl. He mixed it all together. Then the cookies went into the hot oven. Soon a sweet smell filled the house. When the cookies cooled down, Jake gave one to his little sister. She clapped her hands and smiled.",
    "word_count": 58,
    "ar_min": 3.5,
    "ar_max": 3.9
  },
  "44ff3ae4-e68e-450f-94e5-f5464f60ecc4": {
    "content": "Every year, the fourth grade had a spelling bee. This year, Priya wanted to win. She practiced every night with word cards. Her older brother asked her the words at dinner. On the day of the contest, she felt nervous. One by one, her classmates missed hard words. Then it was her turn. The judge read a hard word. Priya took a deep breath. She said each letter slowly. The judge smiled and said she was right. Everyone clapped for her. In the end, only Priya and one other student were left. After a few minutes, Priya spelled the last word right. She had won the spelling bee!",
    "word_count": 108,
    "ar_min": 2.7,
    "ar_max": 3.1
  },
  "466460c3-7051-4c4c-8dae-aee77a5fe07d": {
    "content": "Ben and his family set up a blue tent in their backyard. It was a fun weekend. As the sky grew dark, they lit a small campfire. They toasted sweet marshmallows on sticks. Ben looked up at the night sky. He counted bright stars with his dad. He heard crickets chirping softly. Ben felt warm inside his sleeping bag. Soon he fell fast asleep.",
    "word_count": 64,
    "ar_min": 2.9,
    "ar_max": 3.3
  },
  "e3b28679-3455-48eb-a293-14ab192fe294": {
    "content": "Emma saw an old gate behind her grandfather's garden. Thick green leaves covered the gate. She wondered what was behind it. She pushed the gate open. Behind it was a small hidden garden. It was full of colorful flowers. There was also a stone birdbath. Emma smiled with joy. She knew this quiet spot would be her special place to read.",
    "word_count": 61,
    "ar_min": 3.7,
    "ar_max": 4.1
  },
  "19327e44-619c-439f-b97b-9ee4d0eef36f": {
    "content": "On his first day at a new school, Marcus stood alone. He watched some kids playing basketball nearby. He wished he had someone to talk to. A boy named Tyler saw him standing alone. Tyler walked over and said hello. He asked if Marcus wanted to play too. Marcus said yes and walked over. At first, he missed almost every shot. He felt a little bad about it. Tyler told him not to worry. He showed Marcus how to hold the ball. By the end of recess, Marcus made his first basket. Everyone cheered, and Marcus felt so happy. Tyler introduced him to the other kids at lunch. Marcus learned that making friends was not so hard.",
    "word_count": 117,
    "ar_min": 3.6,
    "ar_max": 4.0
  },
  "d833910f-64ee-4977-b002-b2c77b798275": {
    "content": "Ben's family went camping in the mountains one weekend. He had never slept in a tent before. They walked for two hours on a long trail. At last, they reached their campsite by a clear stream. Ben helped his dad set up the tent. His mom started a small fire for dinner. As the sky grew dark, many stars came out. Ben had never seen so many stars before. His dad showed him a group of stars shaped like a bear. During the night, Ben heard leaves moving outside the tent. He felt a little scared but stayed calm. His sister said it was probably just a hungry raccoon. In the morning, they cooked eggs over the fire. They watched the sunrise turn the sky orange.",
    "word_count": 126,
    "ar_min": 3.4,
    "ar_max": 3.8
  },
  "22f73b61-955b-49f4-b2f6-894f30eddbe2": {
    "content": "Honeybees may look like simple insects buzzing around flowers. But their lives inside the hive are busy and full of work. Thousands of bees live and work together in one hive. Each bee has its own job to do. The queen bee lays almost all of the eggs. She can lay more than a thousand eggs in one day. The worker bees are all female. They do most of the work in the hive. They collect nectar, build the honeycomb, and guard the hive. When a bee finds a good flower, it flies back home. Then it does a special dance to share the news. This is called the waggle dance. It tells other bees where to find the flowers. Bees are very important for our food too. They carry pollen from flower to flower as they fly. This pollen helps fruits and vegetables grow. Sadly, honeybee numbers have dropped in recent years. Chemicals and disease have made life harder for bees. Scientists and farmers are working hard to help them.",
    "word_count": 171,
    "ar_min": 4.1,
    "ar_max": 4.5
  },
  "a0456d00-222e-4fcc-8f0b-5a6f6a01d791": {
    "content": "One clear night, Marcus and his father set up a telescope. They wanted to look closely at the moon and stars. Marcus had learned that the moon makes no light of its own. It just sends back light from the sun. Through the telescope, he saw many craters on the moon. Long ago, rocks from space had crashed into the moon. Some craters were even bigger than whole cities on Earth. Next, they looked at a bright group of stars called the Pleiades. Marcus learned that starlight can travel for hundreds of years. That means the light he saw had left the star long ago. His father showed him how to find the North Star. Sailors have used it for hundreds of years to find their way home. Later that night, a bright shooting star moved fast across the sky. Marcus quickly closed his eyes and made a wish. His father said shooting stars are just small bits of rock. They burn up as they enter our air. By the time they went inside, Marcus felt like he had traveled to space.",
    "word_count": 182,
    "ar_min": 4.1,
    "ar_max": 4.5
  },
  "b3a2921e-c146-469e-9c15-2b74f873a6b2": {
    "content": "A thirsty crow flew over a dry field. He was looking for water. At last, he found a glass jar on a table. But the water was too low for his beak. The crow did not give up. He picked up small stones one by one. He dropped each stone into the jar. Slowly, the water rose to the top. Now the crow could drink the water easily.",
    "word_count": 68,
    "ar_min": 1.6,
    "ar_max": 2.0
  },
  "41ff33b2-7c9c-481b-84bc-c9d4bdb2d1c6": {
    "content": "An old man named Mr. Alvarez moved in next door. Sophie noticed he lived alone. He looked a little lonely. She brought him a plate of cookies with her mom. Mr. Alvarez smiled and said thank you. He had moved to be closer to his grandchildren. Over the next few weeks, Sophie helped him water his garden. She also got his mail while his knee healed. In return, Mr. Alvarez told her stories about his old fishing boat. He had sailed to many countries. Sophie loved hearing about the strange fish he had seen. She began visiting him almost every afternoon after school. Her parents were proud of how kind she had become. By the end of summer, Mr. Alvarez felt like part of the family.",
    "word_count": 126,
    "ar_min": 4.1,
    "ar_max": 4.5
  },
  "8c40f464-9314-4a44-8b3c-572355b78381": {
    "content": "Liam and his friends wanted to play soccer in the park. But they could not find their ball. They looked around the benches. They looked behind the big trees. Then Liam saw the ball near some tall grass. A friendly dog stood beside it, wagging its tail. Liam thanked the dog's owner. He threw the ball back to his team. Then the game began.",
    "word_count": 64,
    "ar_min": 2.5,
    "ar_max": 2.9
  },
  "c95bd73c-1e87-4e34-8c11-21ba05305653": {
    "content": "Liam and his friends wanted to play soccer in the park. But they could not find their ball. They looked around the benches. They looked behind the big trees. Then Liam saw the ball near some tall grass. A friendly dog stood beside it, wagging its tail. Liam thanked the dog's owner. He threw the ball back to his team. Then the game began.",
    "word_count": 64,
    "ar_min": 2.5,
    "ar_max": 2.9
  },
  "d9162bc7-20fe-4ba7-a8f7-17018ce446c0": {
    "content": "Liam and his friends wanted to play soccer in the park. But they could not find their ball. They looked around the benches. They looked behind the big trees. Then Liam saw the ball near some tall grass. A friendly dog stood beside it, wagging its tail. Liam thanked the dog's owner. He threw the ball back to his team. Then the game began.",
    "word_count": 64,
    "ar_min": 2.5,
    "ar_max": 2.9
  },
  "8c9e9841-f55f-408b-81c9-d1e954c903bc": {
    "content": "Oliver moved to a new neighborhood. He felt nervous about going to a new school. On his first day, he sat alone in the lunchroom. He felt quiet and shy. Then a friendly boy named Lucas walked over. He asked if he could sit with Oliver. They talked about video games and soccer. By the end of the day, Oliver felt happy. Making a new friend was easier than he thought.",
    "word_count": 71,
    "ar_min": 3.4,
    "ar_max": 3.8
  },
  "91e509ed-df9e-49bc-935e-edf69e498957": {
    "content": "Oliver moved to a new neighborhood. He felt nervous about going to a new school. On his first day, he sat alone in the lunchroom. He felt quiet and shy. Then a friendly boy named Lucas walked over. He asked if he could sit with Oliver. They talked about video games and soccer. By the end of the day, Oliver felt happy. Making a new friend was easier than he thought.",
    "word_count": 71,
    "ar_min": 3.4,
    "ar_max": 3.8
  },
  "40e78fdd-58b4-437a-b7c8-03e05f28b1e6": {
    "content": "Yesterday, Leo and his sister went outside to play. Suddenly, they heard a strange noise behind the big tree. Leo felt a little scared. But his sister was brave. She walked over to look. Behind the tree, they found their mom with a small basket. \"Surprise!\" mom said with a big smile. She had made a picnic with apples and juice. They sat together and had a nice afternoon.",
    "word_count": 69,
    "ar_min": 3.6,
    "ar_max": 4.0
  },
  "7cfaa584-243d-4dfa-9bf0-69dfa038d1b0": {
    "content": "Yesterday, Leo and his sister went outside to play. Suddenly, they heard a strange noise behind the big tree. Leo felt a little scared. But his sister was brave. She walked over to look. Behind the tree, they found their mom with a small basket. \"Surprise!\" mom said with a big smile. She had made a picnic with apples and juice. They sat together and had a nice afternoon.",
    "word_count": 69,
    "ar_min": 3.6,
    "ar_max": 4.0
  },
  "660fec69-e95d-4c8c-8158-2140af819d79": {
    "content": "The old clock on the wall stopped ticking. Grandpa got his small toolbox. Daniel watched closely as Grandpa opened the back of the clock. Inside were many tiny gold gears. They were all linked together. Grandpa put a drop of oil on the old metal parts. He cleaned them gently. Soon the clock began to tick again.",
    "word_count": 57,
    "ar_min": 3.6,
    "ar_max": 4.0
  },
  "b3e7dc33-e0b1-4b5d-bfb2-be11ce5e4eef": {
    "content": "The weather report said there would only be a little snow. Instead, a big storm hit the town overnight. Maya woke up and saw snow covering the whole street. School was closed, and she could hardly sit still. She put on her warm coat, boots, and mittens. Her little brother came outside with her right away. Together they built a funny snowman with a carrot nose. Later, they found the best hill for sledding nearby. Maya's cheeks turned red from the cold air. She did not want to go back inside at all. Her mom finally called them in for hot chocolate. They warmed up together by the cozy fire. Maya looked out at the quiet, snowy yard. She hoped it would snow again soon.",
    "word_count": 125,
    "ar_min": 4.0,
    "ar_max": 4.4
  },
  "d0199614-ab71-453b-9bf3-8e905dc1bfec": {
    "content": "Early one foggy morning, Maya walked on the beach with her dog, Buster. The air was cool. Small waves rolled onto the shore. Suddenly, Buster stopped and barked softly. He was standing near a pile of wet seaweed. Maya went over to look. She found a tiny sea turtle stuck in the seaweed. It was trying to crawl to the water. Maya gently picked it up. She placed it safely into the waves.",
    "word_count": 73,
    "ar_min": 3.2,
    "ar_max": 3.6
  },
  "05889146-52ee-42d9-847c-8cfb279e6131": {
    "content": "Maya loved to collect colorful leaves in the fall. One windy day, she put on her warm jacket. She walked to the park near her house. She saw a bright yellow leaf falling from a tall tree. Maya ran fast to catch it before it hit the ground. The wind blew it toward the pond. She reached out her hand and caught it. Maya felt proud. She kept the leaf inside her favorite book.",
    "word_count": 74,
    "ar_min": 2.4,
    "ar_max": 2.8
  },
  "db31ed24-33ef-46e7-b193-3bc880b29bf4": {
    "content": "Maya loved to collect colorful leaves in the fall. One windy day, she put on her warm jacket. She walked to the park near her house. She saw a bright yellow leaf falling from a tall tree. Maya ran fast to catch it before it hit the ground. The wind blew it toward the pond. She reached out her hand and caught it. Maya felt proud. She kept the leaf inside her favorite book.",
    "word_count": 74,
    "ar_min": 2.4,
    "ar_max": 2.8
  },
  "968e41b4-53c7-4602-a375-ecf7ee667b08": {
    "content": "As the sun went down, Noah and his little sister ran into the backyard. They brought small glass jars. Tiny fireflies blinked like stars in the warm night air. Noah walked quietly through the grass. He did not want to scare them away. He gently caught one inside his jar. He watched its light glow for a few minutes. Then he opened the lid. He let the firefly fly back into the dark sky.",
    "word_count": 74,
    "ar_min": 3.2,
    "ar_max": 3.6
  },
  "c4b498ce-6db5-4b10-90be-9d8629c14bd2": {
    "content": "The library had a summer reading contest. Leo wanted to win a prize this year. He picked out three thick books about lost treasure. Every afternoon, Leo sat on his porch swing. He read many pages and drank cold lemonade. When he finished his books, he took them back to the librarian. She smiled and put a gold star by his name on the big board.",
    "word_count": 66,
    "ar_min": 4.1,
    "ar_max": 4.5
  },
  "ea1da6a4-25b6-44c1-a1cc-2903e097d7c8": {
    "content": "Every winter, the school had a talent show. Priya had practiced her violin for months. As the show got closer, she felt nervous. Her teacher told her to breathe deeply. Backstage, she watched kids do tricks and dances. When her name was called, her legs felt shaky. She walked onto the big stage. She closed her eyes for a moment. Then she played a soft, gentle song. The room listened quietly to her music. When she finished, everyone clapped. Priya walked off with a big smile. She felt proud she had faced her fear. Everyone said her music was wonderful.",
    "word_count": 100,
    "ar_min": 3.7,
    "ar_max": 4.1
  },
  "05998196-9a58-4744-b740-4120eb497dcd": {
    "content": "One summer morning, Clara and her grandmother planted a tiny sunflower seed. They planted it in a sunny corner of the garden. Every day after lunch, Clara poured water onto the dirt. She waited for two weeks. Then a tiny green sprout came out of the earth. Clara was so excited. She watched her plant grow taller every day. At last, it bloomed into a bright yellow flower.",
    "word_count": 68,
    "ar_min": 4.3,
    "ar_max": 4.7
  },
  "277d51ef-e89e-4e93-bfd4-1b5bef6240de": {
    "content": "Mr. Foster's class had a debate. The topic was school start times. Should school start later? The class split into two teams. Sofia argued for a later start. She spent a week on the topic. She learned that kids need nine hours of sleep. On debate day, Sofia felt nervous. She stood with her note cards. The other team said a later start was bad. They said it would mess up after-school plans. Sofia shared the facts she knew. She used real numbers to prove her point. The other team asked hard questions. Sofia took a deep breath. She answered each one calmly. Then the class voted. Sofia's team won by a lot. She felt proud of her hard work. She learned that facts beat loud words.",
    "word_count": 127,
    "ar_min": 2.5,
    "ar_max": 2.9
  },
  "8920f09e-b58e-44c7-97e0-a55d1b95b6e2": {
    "content": "During the fall festival, Henry tried to find his way through a big corn maze. It was near his grandfather's farm. The tall corn grew high above his head. He could not see the way out. Henry did not panic. He remembered his teacher's advice. He kept one hand on the right wall. He turned down three paths. At last, he saw the bright exit sign. He cheered and ran out into the open field.",
    "word_count": 75,
    "ar_min": 2.3,
    "ar_max": 2.7
  },
  "9189678c-80e5-447c-b8fb-97e9b8868700": {
    "content": "Mrs. Patel's class went to the history museum. The kids were excited to see dinosaur bones. A guide told them how scientists dig up bones. She said the bones fit together like a puzzle. Ethan asked how long it takes to find one. The guide said it can take years. Next they saw old statues from Egypt. There were painted pots and gold jewelry. Ethan's friend Maya liked a mummy case. Before they left, they touched a real meteorite. It had fallen from space long ago. On the bus ride home, Ethan talked and talked. That night, he told his parents he wanted to be a scientist.",
    "word_count": 107,
    "ar_min": 3.8,
    "ar_max": 4.2
  },
  "e00de8b2-e94b-4963-b514-156f28c8e7b8": {
    "content": "One morning, Mrs. Reyes could not find the closet key. The class wanted to help. Amir checked the lost box near the office. The key was not there. Next, they looked under desks. They checked the cubbies too. No one found it. Then Ella remembered something. The janitor had the key. They found him in the hall. The key was still in his pocket. Everyone laughed and felt glad. Mrs. Reyes thanked the class. She hung a spare key on a hook. The class called themselves great helpers.",
    "word_count": 88,
    "ar_min": 2.2,
    "ar_max": 2.6
  }
}


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


def fetch_current(env, ids):
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    id_list = ",".join(ids)
    resp = requests.get(
        f"{url}/rest/v1/passages",
        params={"select": "id,content,word_count,ar_min,ar_max", "id": f"in.({id_list})"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    resp.raise_for_status()
    return {row["id"]: row for row in resp.json()}


def patch_one(env, passage_id, fields):
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    resp = requests.patch(
        f"{url}/rest/v1/passages",
        params={"id": f"eq.{passage_id}"},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=fields,
    )
    resp.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="실제로 DB에 반영")
    args = parser.parse_args()

    env = load_env()
    current = fetch_current(env, list(PATCHES.keys()))

    print(f"적용 대상 {len(PATCHES)}개 지문\n")
    for pid, new in PATCHES.items():
        old = current.get(pid)
        if not old:
            print(f"  경고: {pid} 를 DB에서 못 찾음 — 건너뜀")
            continue
        old_label = f"{old['ar_min']:.1f}-{old['ar_max']:.1f}"
        new_label = f"{new['ar_min']:.1f}-{new['ar_max']:.1f}"
        print(f"{pid[:8]}  words {old['word_count']}→{new['word_count']}  label {old_label}→{new_label}")

    if args.apply:
        print("\n--apply 지정됨: DB에 반영 중...")
        failed = []
        for pid, new in PATCHES.items():
            if pid not in current:
                continue
            try:
                patch_one(env, pid, new)
            except Exception as e:
                failed.append((pid, str(e)))
        print(f"완료: {len(PATCHES) - len(failed)}개 성공, {len(failed)}개 실패")
        for pid, err in failed:
            print(f"  실패 {pid}: {err}")
    else:
        print("\n(dry-run — DB에는 아무것도 반영되지 않았습니다. 반영하려면 --apply를 추가하세요.)")


if __name__ == "__main__":
    main()
