const OpenAI = require('openai');
const logger = require("firebase-functions/logger");

const processInitialMessage = async () => {
  const key = "figure out enviroment";
  const openai = new OpenAI({apiKey:key});
  const assistant = await openai.beta.assistants.retrieve("assistant id");
  logger.log(assistant.id);
}

module.exports = {
  processInitialMessage,
}