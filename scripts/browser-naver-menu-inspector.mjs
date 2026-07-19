const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function stripQuotedValue(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed;
}

function parseMenus(snapshot) {
  const lines = snapshot.split("\n");
  const menus = [];
  const badgePattern = /^(대표|인기|예약|추천|신메뉴|신규|NEW|섬네일|사진|원|새 창)$/i;

  for (let index = 0; index < lines.length; index += 1) {
    const topMatch = lines[index].match(/^(\s*)- (button|link) "(.+)"(?::)?$/);
    if (
      !topMatch ||
      !/(?:\d[\d,]*(?:~\d[\d,]*)?원|변동)/.test(topMatch[3])
    ) {
      continue;
    }

    const indentation = topMatch[1].length;
    const values = [];

    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const childIndentation = lines[childIndex].match(/^(\s*)/)?.[1].length ?? 0;
      if (lines[childIndex].trim().startsWith("- ") && childIndentation <= indentation) {
        break;
      }

      const valueMatch = lines[childIndex].match(
        /^\s*- (?:generic|text|strong): (.+)$/
      );
      if (valueMatch) values.push(stripQuotedValue(valueMatch[1]));
    }

    const price =
      values.find((value) => /^(?:\d[\d,]*(?:~\d[\d,]*)?원|변동)$/.test(value)) ??
      topMatch[3].match(
        /(?:\d[\d,]*(?:~\d[\d,]*)?원|변동)(?!.*(?:\d[\d,]*원|변동))/
      )?.[0];
    const name = values.find(
      (value) =>
        value &&
        value !== price &&
        !badgePattern.test(value) &&
        !/^주문 \d+$/.test(value)
    );

    if (
      !name ||
      !price ||
      name === "온누리 사용 가능매장" ||
      menus.some((menu) => menu.name === name && menu.price === price)
    ) {
      continue;
    }

    const description = values
      .filter(
        (value) =>
          value !== name &&
          value !== price &&
          !badgePattern.test(value) &&
          !/^주문 \d+$/.test(value)
      )
      .join(" ")
      .slice(0, 300);

    menus.push({ name, price, description });
  }

  return menus;
}

function cleanCoreName(name, address) {
  let normalizedName = name.replace(/\(현재 폐업\)/g, "").trim();
  const firstToken = normalizedName.split(/\s+/)[0];

  if (address.includes(firstToken) && normalizedName.includes(" ")) {
    normalizedName = normalizedName.slice(firstToken.length).trim();
  }

  return normalizedName;
}

function addressQueryTokens(address) {
  return address
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
}

function nodeIdFromLine(line) {
  return line?.match(/node_id=(\d+)/)?.[1];
}

export function createNaverMenuInspector(tab) {
  const entryFrame = tab.playwright.frameLocator("#entryIframe");

  async function search(query) {
    await tab.playwright.domSnapshot();
    const searchBox = tab.playwright.getByRole("combobox");
    const searchBoxCount = await searchBox.count();
    if (searchBoxCount !== 1) {
      return { error: "searchbox", count: searchBoxCount };
    }

    await searchBox.fill(query);
    await searchBox.press("Enter");
    await wait(1_250);

    return {
      url: await tab.url(),
      dom: await tab.dom_cua.get_visible_dom(),
    };
  }

  async function openBestResult(item) {
    const coreName = cleanCoreName(item.name, item.address);
    const query = `${coreName} ${addressQueryTokens(item.address).join(" ")}`;
    const searchResult = await search(query);
    await wait(650);

    let url = await tab.url();
    let dom = await tab.dom_cua.get_visible_dom();

    if (!/\/(?:entry\/)?place\/\d+/.test(url)) {
      const lines = dom.split("\n");
      const coreWords = coreName
        .replace(/\([^)]*\)/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2);
      const targetTokens = item.address
        .replace(/[()]/g, " ")
        .split(/\s+/)
        .filter((token) => /(?:시|구|군|읍|면|동|가)$/.test(token));
      const candidates = [];

      for (let index = 0; index < lines.length; index += 1) {
        if (!/상세주소 열기/.test(lines[index])) continue;
        const score =
          targetTokens.filter((token) => lines[index].includes(token)).length * 10;
        let cardLine;

        for (
          let cardIndex = index - 1;
          cardIndex >= Math.max(0, index - 6);
          cardIndex -= 1
        ) {
          if (
            /role="button"/.test(lines[cardIndex]) &&
            !/영업|리뷰|쿠폰|저장|출발|도착|상세주소/.test(lines[cardIndex]) &&
            coreWords.some((word) => lines[cardIndex].includes(word))
          ) {
            cardLine = lines[cardIndex];
            break;
          }
        }

        if (cardLine) candidates.push({ score, line: cardLine });
      }

      if (candidates.length === 0) {
        const fallbackLine = lines.find(
          (line) =>
            /role="button"/.test(line) &&
            !/영업|리뷰|쿠폰|저장|출발|도착|상세주소/.test(line) &&
            coreWords.some((word) => line.includes(word))
        );
        if (fallbackLine) candidates.push({ score: 0, line: fallbackLine });
      }

      candidates.sort((left, right) => right.score - left.score);
      const resultNodeId = nodeIdFromLine(candidates[0]?.line);

      if (resultNodeId) {
        await tab.dom_cua.click({ node_id: resultNodeId });
        await wait(1_050);
        url = await tab.url();
        dom = await tab.dom_cua.get_visible_dom();
      }
    }

    return { coreName, query, url, dom, searchError: searchResult.error };
  }

  async function inspect(item) {
    const opened = await openBestResult(item);
    let { url, dom } = opened;
    const placeId = url.match(/\/(?:entry\/)?place\/(\d+)/)?.[1] ?? null;

    if (!placeId) {
      return { ...item, outcome: "not_found", query: opened.query, url };
    }

    let lines = dom.split("\n");
    if (!lines.some((line) => /role="tab">홈/.test(line))) {
      await wait(900);
      dom = await tab.dom_cua.get_visible_dom();
      lines = dom.split("\n");
    }
    const addressLine = lines.find(
      (line) =>
        /role="button">(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(
          line
        ) && !/상세주소/.test(line)
    );
    let pageAddress =
      addressLine?.replace(/^.*role="button">/, "").replace(/<\/a>$/, "") ?? "";
    let jibun = "";
    const addressNodeId = nodeIdFromLine(addressLine);

    if (addressNodeId) {
      try {
        await tab.dom_cua.click({ node_id: addressNodeId });
        await wait(150);
        const addressSnapshot = await tab.playwright.domSnapshot();
        const addressMatch = addressSnapshot.match(
          /generic: 도로명[\s\S]{0,400}?text: ([^\n]+)[\s\S]{0,300}?generic: 지번[\s\S]{0,200}?text: ([^\n]+)/
        );
        if (addressMatch) {
          pageAddress = addressMatch[1].trim();
          jibun = addressMatch[2].trim();
        }
      } catch {
        // Some place categories expose an address button that does not expand.
      }
    }

    dom = await tab.dom_cua.get_visible_dom();
    lines = dom.split("\n");
    const menuLine = lines.find((line) => /role="tab">메뉴/.test(line));
    const menuNodeId = nodeIdFromLine(menuLine);

    if (!menuNodeId) {
      return {
        ...item,
        outcome: "no_menu_tab",
        placeId,
        pageAddress,
        jibun,
        url,
      };
    }

    await tab.dom_cua.click({ node_id: menuNodeId });
    await wait(650);
    let menuSnapshot = await tab.playwright.domSnapshot();

    if (menuSnapshot.includes("펼쳐서 더보기")) {
      try {
        const moreButton = entryFrame.getByRole("button", {
          name: "펼쳐서 더보기",
          exact: true,
        });
        const moreButtonCount = await moreButton.count();

        if (moreButtonCount === 1) {
          await moreButton.click({ force: true });
          await wait(300);
        } else {
          const moreSpan = entryFrame.locator("span.TeItc");
          const moreSpanCount = await moreSpan.count();
          if (moreSpanCount === 1) {
            await moreSpan.click({ force: true });
            await wait(300);
          }
        }

        menuSnapshot = await tab.playwright.domSnapshot();
      } catch {
        // The current menu can still be parsed when the expansion control disappears.
      }
    }

    const menus = parseMenus(menuSnapshot);
    return {
      ...item,
      outcome: menus.length > 0 ? "menus" : "menu_tab_empty",
      placeId,
      pageAddress,
      jibun,
      url,
      menus,
    };
  }

  return { inspect, parseMenus, search };
}
