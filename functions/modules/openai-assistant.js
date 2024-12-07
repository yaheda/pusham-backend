const OpenAI = require('openai');
const logger = require("firebase-functions/logger");

/// https://medium.com/@ralfelfving/tutorial-get-started-with-the-new-openai-assistants-api-7049c2517bfe
/// https://github.com/rokbenko/ai-playground/blob/main/openai-tutorials/2-Build_personal_math_tutor/personal_math_tutor.js


const processInitialMessage = async (message) => {
  const key = process.env.OPENAI_API_KEY;
  const openai = new OpenAI({apiKey:key});
  const assistant = await openai.beta.assistants.retrieve("asst_RzR7AstvMFBaLcLfHzANorpk");
  logger.log(assistant.id);


  const thread = await openai.beta.threads.create();
  // let run = await openai.beta.threads.runs.createAndPoll(thread.id, { 
  //   assistant_id: assistant.id,
  //   instructions: message
  // });
  
  logger.log("Adding message");
  const response = await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: message,
  });

  logger.log(response);

  logger.log("Running assistant");
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
  });

  logger.log(run);

  let runStatus = await openai.beta.threads.runs.retrieve(
    thread.id,
    run.id
  );
  while (runStatus.status !== "completed") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    logger.log(`Run status: ${runStatus.status}`);
  }

  // Get the last assistant message from the messages array
  const messages = await openai.beta.threads.messages.list(thread.id);
  logger.log(messages);
  // Find the last message for the current run
  const lastMessageForRun = messages.data
  .filter(
    (message) => message.run_id === run.id && message.role === "assistant"
  )
  .pop();

  // If an assistant message is found, console.log() it
  logger.log('Last message run')
  if (lastMessageForRun) {
    const jsonText = `${lastMessageForRun.content[0].text.value} \n`;
    logger.log(jsonText);
    return JSON.parse(jsonText);
  }

  return {}

}

const quickPrompt = async (prompt) => {
  logger.log('quickPrompt', prompt);
  const key = process.env.OPENAI_API_KEY;
  const openai = new OpenAI({apiKey:key});
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      //{ role: "system", content: "You are a helpful assistant." }, 
      {
      role: "user",
      content: prompt,
    }]
  });
  logger.log('OpenAI Chat response:', response);
  return response.choices[0].message.content;
}

module.exports = {
  processInitialMessage,
  quickPrompt
}