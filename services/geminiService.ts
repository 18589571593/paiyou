import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the client
// Ensure API_KEY is available in the environment
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("未在环境变量中找到 API 密钥。");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Transcribes media content (Audio or Video) using Gemini 2.5 Flash.
 * @param base64Data - The base64 encoded string of the media file (without data URI prefix).
 * @param mimeType - The MIME type of the media (e.g., 'audio/mp3', 'video/mp4').
 * @returns The transcribed text.
 */
export const transcribeMedia = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Using gemini-2.5-flash for speed and efficiency with multimodal inputs
    const modelId = 'gemini-2.5-flash';

    const prompt = `
      你是一位专业的速记员。
      请为提供的媒体内容提供高度准确的逐字转录。
      
      【重要指令 - 必须严格遵守】
      1. **中文内容强制简体化**：如果音频中包含任何形式的中文（包括普通话、粤语、台湾口音、新加坡华语等），**必须**将所有转录文本转换为**简体中文**输出。**严禁**输出繁体中文。
      2. **外语保留原文**：如果音频是外语（如英语、日语、韩语等），请直接记录其**原文**，**不要**翻译成中文。

      通用指南：
      1. 准确区分并标识不同的发言者（例如：“发言者 1:”，“发言者 2:”）。
      2. 忽略对语意无影响的填充词（如“嗯”、“呃”），除非它们对语境至关重要。
      3. 根据语境在自然的停顿处清晰分段，确保排版整洁易读。
      4. 如果未检测到可听见的语音，请输出“[未检测到语音]”。
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    return response.text || "未生成任何文本。";
  } catch (error: any) {
    console.error("Gemini 转录错误:", error);
    throw new Error(error.message || "媒体转录失败。");
  }
};

/**
 * Corrects the transcribed text (grammar, punctuation, typos).
 */
export const correctText = async (text: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash';

    const prompt = `
      你是一位专业的中文校对编辑。
      请对以下提供的文本进行校对和修正。
      
      任务要求：
      1. 修正所有的错别字、错误的标点符号和不通顺的断句。
      2. 保持原意完全不变，不要删除或添加内容，只做修正。
      3. **强制输出简体中文**：无论输入文本是繁体还是简体，最终输出结果必须全部转换为**简体中文**。
      4. 直接输出修正后的文本，不要包含任何“这是修正后的文本”之类的开场白。

      待修正文本：
      ${text}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Gemini 纠错错误:", error);
    throw new Error(error.message || "文本纠错失败。");
  }
};

/**
 * Rewrites/Spins the transcribed text.
 * @param text The original text.
 * @param intensity 1-10 scale of rewrite intensity.
 */
export const rewriteText = async (text: string, intensity: number = 5): Promise<string> => {
  try {
    const ai = getAiClient();
    const modelId = 'gemini-2.5-flash';

    let intensityGuidance = "";
    if (intensity <= 3) {
      intensityGuidance = "保留模式（强度低）：极大程度保留原文的句式、语气和长度。仅替换极少数生僻词或同义词。风格必须与原文高度一致。";
    } else if (intensity <= 7) {
      intensityGuidance = "平衡模式（强度中）：优化句子结构，使表达更自然流畅。可以适当调整语序，替换常用词汇，但核心信息点和段落结构保持不变。";
    } else {
      intensityGuidance = "创意模式（强度高）：大胆重写。彻底改变行文风格和用词习惯。可以在保持原意的前提下，大幅度调整句式、使用比喻或更高级的词汇，甚至改变文章的语气（例如从口语化变为书面化）。";
    }

    const prompt = `
      你是一位资深的文案策划。
      请对以下提供的文本进行“洗稿”或仿写处理。
      
      当前洗稿强度等级：${intensity} / 10
      具体执行策略：${intensityGuidance}
      
      任务要求：
      1. 核心意思和信息量必须保持不变，不得曲解原意。
      2. **强制输出简体中文**：无论输入文本是繁体还是简体，最终输出结果必须全部转换为**简体中文**。
      3. 直接输出重写后的文本，不要包含任何解释性语言（如“这是重写后的版本”）。

      待重写文本：
      ${text}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Gemini 洗稿错误:", error);
    throw new Error(error.message || "文本洗稿失败。");
  }
};