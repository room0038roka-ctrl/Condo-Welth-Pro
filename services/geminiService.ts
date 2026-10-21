
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { SimulationInputs, SimulationResults } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * テキストからJSONを抽出する堅牢な関数
 */
const parseJsonFromText = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/```\n?([\s\S]*?)\n?```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
      }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      }
    } catch (e) {
      console.error("JSON parsing failed:", e);
    }
  }
  return null;
};

const extractSourcesFromResponse = (response: any) => {
  try {
    const candidate = response?.candidates?.[0];
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources: { title: string; uri: string }[] = [];
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) {
        sources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri
        });
      }
    });
    return sources;
  } catch (e) {
    return [];
  }
};

export const getPropertyPitfallsAnalysis = async (url: string, inputs: SimulationInputs, results: SimulationResults) => {
  const prompt = `
    あなたは不動産の超プロフェッショナルな不動産インスペクター・辛口コンサルタントです。
    この物件（SUUMO等の紹介ページや基本条件）を徹底的にスクリーニングし、一見気づきにくい「重大な落とし穴」や「隠れた懸念点」を辛口かつ論理的に炙り出してください。

    【解析対象URL】${url || '未設定（手動入力データのみ）'}
    【物件基本データ】
    - 物件名 (propertyName): ${inputs.propertyName || '未設定'}
    - 住所 (propertyAddress): ${inputs.propertyAddress || '未設定'}
    - 物件価格 (purchasePrice): ${inputs.purchasePrice.toLocaleString()}円
    - 専有面積 (areaSize): ${inputs.areaSize}㎡
    - 管理費 (maintenanceFee): 月額 ${inputs.maintenanceFee.toLocaleString()}円 (約 ${Math.round(inputs.maintenanceFee / (inputs.areaSize || 1))}円/㎡)
    - 修繕積立金 (repairFund): 月額 ${inputs.repairFund.toLocaleString()}円 (約 ${Math.round(inputs.repairFund / (inputs.areaSize || 1))}円/㎡)
    - 最寄駅 (nearestStation): ${inputs.nearestStation || '未設定'} (徒歩 ${inputs.walkMinutes}分)
    - 築年数 (buildingAge): ${inputs.buildingAge}年 (基準年: 2026年)
    - 建物種別 (buildingType): ${inputs.buildingType === 'existing' ? '中古マンション' : '新築・築浅マンション'}

    【分析・診断してほしい「落とし穴（懸念点）」のカテゴリ】
    1. 🚨【修繕積立金・維持費の妥当性評価（最も重要）】
       - 国土交通省のガイドライン（㎡あたり月額200円〜300円前後、築20年越えなら300円以上が健康的な目安）と比較してください。
       - この物件の平米単価（現在：約 ${Math.round(inputs.repairFund / (inputs.areaSize || 1))}円/㎡）は安すぎませんか、あるいは高すぎませんか？
       - 安すぎる場合の重大なリスク（将来の急激な値上げ、一時金の足かせ、大規模修繕未実施リスク）や、高すぎる場合の管理費使い込み不信を論理的に解説してください。
    2. 📍【立地・交通・周辺環境の盲点】
       - 最寄駅「${inputs.nearestStation}」から徒歩 ${inputs.walkMinutes}分 という条件、および「${inputs.propertyAddress}」の立地は将来のリセールや賃貸化においてどのような盲点・リスクがありますか？
       - 徒歩7分超えや、線路沿い、幹線道路、ハザード（水害や土砂災害、低地など）を含む周辺環境の懸念点を厳しく指摘してください。
    3. 🏗️【施工会社・開発デベロッパーの素性】
       - 該当物件にかかわる一般的に特定されるブランド・施工・売主企業について、判明可能な限り信頼性、資産価値、過去の不祥事（杭問題、欠陥住宅など）への懸念を検証してください。
    4. 🧹【管理体制・維持管理リスク】
       - 自主管理などのリスクがないか。管理会社の種類や、管理コストに見合うサービス内容かを指摘してください。
    5. 📐【構造・設備・専有部の隠れた仕様制限（直床 vs 二重床、配管など）】
       - 築年数「${inputs.buildingAge}年」をふまえ、この時代の標準的な仕様の特徴（直床か二重床か、二重天井か、配管がコンクリートに埋め殺されているスラブ貫通かなど）、断熱性・遮音性のリスクを指摘してください。
    6. 📄【瑕疵告知や心理的瑕疵、その他特別な条件】
       - 告知事項、定期借地権、容積率オーバー、持分敷地権など、URLやデータから疑わしい、または注意すべき罠を提示してください。
    7. 💡【総合評価：この物件を買うべきではない人】
       - 辛口かつ公平な結論として、「どのようなライフスタイル、価値観、資金計画の人には、この物件は絶対に向かないか」を1文から2文でズバッと突きつけてください。

    【回答の出力フォーマット】
    - 一般的なお世辞は一切不要です。プロのエージェントが顧客を守るために、現地を視察したり重要事項説明書を読んで懸念点をチェックするようなトーンでお願いします。
    - 見やすく整理されたMarkdown形式で、重要なワードは太字で際立たせてください。
    - 情報がURL等のページに明確に検出できない項目は、「URLに直接記載はありませんが、築年数やエリアの特性から●●のリスク（例えば、築●年世代のマンションに多いスラブ配管など）が想定されます」と、プロの推測（築年数や地域データに基づく見解）を必ず付け加えて回答を充実させてください。
  `;

  // URLが含まれている場合は urlContext + googleSearch を使用、そうでない場合は googleSearch のみ使用する
  const hasValidUrl = url && (url.startsWith('http://') || url.startsWith('https://'));
  const tools = hasValidUrl ? [{ urlContext: {} }, { googleSearch: {} }] : [{ googleSearch: {} }];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Pitfalls Analysis Error:", error);
    return { text: "物件の『落とし穴』の解析中にエラーが発生しました。時間を置いて再度お試しください。" };
  }
};

export const extractPropertyFromUrl = async (url: string) => {
  const prompt = `
    指定された不動産物件のURLから情報を抽出してください。
    URL: ${url}

    【抽出項目】
    - propertyName: マンション名
    - purchasePrice: 円単位の数値（例: 50000000）
    - areaSize: ㎡単位の数値（例: 70.5）
    - maintenanceFee: 月額管理費の数値
    - repairFund: 月額修繕積立金の数値
    - propertyAddress: 住所
    - nearestStation: 最寄駅名（例：「大崎」や「大崎駅」など）
    - walkMinutes: 最寄駅からの徒歩分数（数値、例：5）
    - buildingAge: 築年数。SUUMO等のURL内で指定されている「完成時期」「竣工年月」「築年月」などの情報から西暦の完成年を取得し、基準年である【2026年】からその完成年を引き算して正確に算出した数値を設定してください（例: 完成時期が2016年3月の場合、2026 - 2016 = 10年 なので 10 と設定）。新築、未完成、あるいは完成予定が2026年以降の場合は 0 としてください。適当な推測ではなく、ページ内の完成時期や築年月の情報を特定した上で、2026年との差を計算してください。
    - buildingType: 'existing' 固定
    - estimatedMonthlyRent: この物件と「同一マンション・同一専有面積」、または近隣の類似グレード分譲マンションに賃貸として住んだ場合の想定月額賃料（管理費・共益費込みの円単位数値）。相場事例から現実的に推計してください。
    - estimatedRentReasoning: 想定賃料の根拠（例: 同マンション同一平米の賃貸事例で共益費込み約23万円、または最寄り駅徒歩5分・70㎡の分譲賃貸相場約22万〜24万円に基づく）
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            propertyName: { type: Type.STRING },
            purchasePrice: { type: Type.NUMBER },
            areaSize: { type: Type.NUMBER },
            maintenanceFee: { type: Type.NUMBER },
            repairFund: { type: Type.NUMBER },
            propertyAddress: { type: Type.STRING },
            nearestStation: { type: Type.STRING },
            walkMinutes: { type: Type.NUMBER },
            buildingAge: { type: Type.NUMBER },
            buildingType: { type: Type.STRING },
            estimatedMonthlyRent: { type: Type.NUMBER },
            estimatedRentReasoning: { type: Type.STRING }
          },
          required: ["propertyName", "purchasePrice", "areaSize"]
        }
      }
    });

    const data = JSON.parse(response.text);
    return { data };
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw new Error("物件情報の取得に失敗しました。URLが正しいか、または手動で入力してください。");
  }
};

/**
 * マンション名・最寄駅・平米数等から同等賃貸の募集・成約相場をWebリサーチする関数（A案）
 * 具体的な賃貸事例や参照元URLも抽出
 */
export const estimateEquivalentRent = async (inputs: {
  propertyName?: string;
  propertyAddress?: string;
  nearestStation?: string;
  walkMinutes?: number;
  areaSize?: number;
  buildingAge?: number;
  purchasePrice?: number;
}) => {
  const prompt = `
    不動産賃貸の専門家として、以下の購入検討物件と「同レベル・同スペックの部屋」に賃貸で住む場合の月額賃料相場（共益費・管理費込み）をWebリサーチし推計してください。
    ユーザーは「賃料の算定根拠や具体例、およびその物件へのアクセスURL」を必要としています。

    【対象物件の条件】
    - 物件名: ${inputs.propertyName || '未設定'}
    - 住所・エリア: ${inputs.propertyAddress || '未設定'}
    - 最寄り駅: ${inputs.nearestStation || '未設定'} (徒歩 ${inputs.walkMinutes || 0}分)
    - 専有面積: ${inputs.areaSize || 0}㎡
    - 築年数: ${inputs.buildingAge || 0}年
    - 想定購入価格: ${inputs.purchasePrice ? inputs.purchasePrice.toLocaleString() + '円' : '未設定'}

    【調査・算出の要件】
    1. 同一マンション（「${inputs.propertyName}」）での同一・類似平米数の過去・現在の賃貸募集事例をWeb検索（SUUMO、LIFULL HOME'S、at home、マンションレビュー等）してください。
    2. 同一マンションにない場合は、最寄り駅「${inputs.nearestStation}」徒歩${inputs.walkMinutes}分前後、専有面積${inputs.areaSize}㎡前後、築${inputs.buildingAge}年と同等グレードの分譲賃貸マンションの募集賃料事例を検索してください。
    3. 管理費・共益費を含んだ「月額の総賃料（円単位）」を整数で推計してください。
    4. 推計の根拠（同マンションの募集事例、周辺の平米単価、類似分譲賃貸の成約相場など）を具体的に解説してください。
    5. 【超重要】リサーチの際に参考にした「具体的な物件・募集事例（マンション名、所在階、面積、月額賃料）」と、その物件や相場情報が確認できる「アクセスURL（SUUMO/HOME'S/at home等の該当ページURL）」を可能な限り抽出して含めてください。

    必ず以下のJSON形式で出力してください:
    {
      "estimatedMonthlyRent": 数値（例: 230000）,
      "reasoning": "推計根拠の説明文（150字程度）",
      "specificExamples": [
        {
          "propertyName": "マンション名・部屋情報（例: ○○マンション 5階）",
          "rentText": "月額賃料表示（例: 23.5万円（管理費込））",
          "area": "専有面積（例: 70.2㎡）",
          "floor": "所在階（例: 5階）",
          "url": "その物件・募集事例へのアクセスURL",
          "sourceName": "サイト名（例: SUUMO / HOME'S）"
        }
      ],
      "sourceUrls": [
        {
          "title": "ページタイトルまたはサイト名",
          "uri": "アクセスURL"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedMonthlyRent: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            specificExamples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  propertyName: { type: Type.STRING },
                  rentText: { type: Type.STRING },
                  area: { type: Type.STRING },
                  floor: { type: Type.STRING },
                  url: { type: Type.STRING },
                  sourceName: { type: Type.STRING }
                },
                required: ["propertyName", "rentText"]
              }
            },
            sourceUrls: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  uri: { type: Type.STRING }
                },
                required: ["uri"]
              }
            }
          },
          required: ["estimatedMonthlyRent", "reasoning"]
        }
      }
    });

    const parsed = parseJsonFromText(response.text) || JSON.parse(response.text);
    const groundingSources = extractSourcesFromResponse(response);
    
    // AI出力内のsourceUrlsとグラウンディングchunksの両方を合算して重複排除
    const urlMap = new Map<string, string>();
    groundingSources.forEach(s => {
      if (s.uri) urlMap.set(s.uri, s.title || s.uri);
    });
    if (Array.isArray(parsed.sourceUrls)) {
      parsed.sourceUrls.forEach((s: any) => {
        if (s.uri && !urlMap.has(s.uri)) {
          urlMap.set(s.uri, s.title || s.uri);
        }
      });
    }
    if (Array.isArray(parsed.specificExamples)) {
      parsed.specificExamples.forEach((ex: any) => {
        if (ex.url && !urlMap.has(ex.url)) {
          urlMap.set(ex.url, `${ex.propertyName || '賃貸事例'} (${ex.rentText || ''})`);
        }
      });
    }

    const combinedSources: { title: string; uri: string }[] = Array.from(urlMap.entries()).map(([uri, title]) => ({
      title,
      uri
    }));

    return {
      estimatedMonthlyRent: parsed.estimatedMonthlyRent || 0,
      reasoning: parsed.reasoning || '',
      examples: Array.isArray(parsed.specificExamples) ? parsed.specificExamples : [],
      sources: combinedSources
    };
  } catch (error: any) {
    console.error("Rent Estimation Error:", error);
    // フォールバック: 利回り4%目安などから算出
    const fallbackRent = inputs.purchasePrice ? Math.round((inputs.purchasePrice * 0.04) / 12 / 1000) * 1000 : 200000;
    return {
      estimatedMonthlyRent: fallbackRent,
      reasoning: "AI検索が混雑等により一時的に完了しなかったため、想定利回り（約4.0%）および面積基準から概算値を算出しました。必要に応じて微調整してください。",
      examples: [],
      sources: []
    };
  }
};

export const getHazardAnalysis = async (address: string) => {
  if (!address || address.trim() === '' || address === '未設定') {
    return { text: "住所が入力されていません。物件の住所を入力して実行してください。", sources: [] };
  }

  const prompt = `
    住所「${address}」周辺のハザードマップ情報（水害・洪水浸水想定、高潮、土砂災害警戒区域、地震危険度、液状化可能性）をGoogle検索でリサーチし、購入検討者向けにわかりやすく簡潔に要約してください。
    
    【回答フォーマット】
    - 🌊 **洪水・内水浸水リスク**: （想定される浸水深、近隣河川の氾濫危険度）
    - ⛰️ **土砂災害リスク**: （土砂災害警戒区域や急傾斜地の有無）
    - ⚡ **地震・液状化リスク**: （地盤の強さ、揺れやすさ、埋立地等の液状化可能性）
    - 💡 **防災ワンポイント**: （ハザードを踏まえた階数選びや備えの助言）
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
    });
    const sources = extractSourcesFromResponse(response);
    return { text: response.text, sources };
  } catch (error: any) {
    console.error("Hazard Analysis Error:", error);
    return { text: "ハザード情報の取得中にエラーが発生しました。時間を置いて再度お試しいただくか、各自治体のWebハザードマップをご確認ください。", sources: [] };
  }
};

export const getExitStrategyData = async (address: string, yearsHeld: number, nearestStation?: string, buildingAge?: number) => {
  if (!address || address.trim() === '' || address === '未設定') {
    return { text: "住所が入力されていません。物件の住所を入力して実行してください。", sources: [] };
  }

  const futureAge = (buildingAge || 10) + yearsHeld;
  const prompt = `
    住所「${address}」（最寄駅: ${nearestStation || '周辺'}）エリアで、今から${yearsHeld}年後（築${futureAge}年前後）に相当する中古マンションの現在の成約平米単価、坪単価相場、および出口戦略（リセール・売却しやすさ・賃貸転用可能性）をリサーチして要約してください。

    【回答フォーマット】
    - 📈 **築${futureAge}年時点の想定平米単価・坪単価**: （現在における該当エリア築${futureAge}年前後の成約水準）
    - 🏢 **需要と売却スピード**: （ファミリー層需要、駅徒歩分数によるリセール流動性）
    - 🔑 **賃貸転用時の見通し**: （将来賃貸に出した場合の借り手需要や想定利回り）
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
    });
    const sources = extractSourcesFromResponse(response);
    return { text: response.text, sources };
  } catch (error: any) {
    console.error("Exit Strategy Error:", error);
    return { text: "将来相場データの取得中にエラーが発生しました。時間を置いて再度お試しください。", sources: [] };
  }
};
