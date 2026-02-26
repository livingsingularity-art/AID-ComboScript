/** Verbalized Sampling
 * https://arxiv.org/html/2510.01171v3
 * MIT License
 * Copyright (c) 2025 Xilmanaath
 */
const modifier = (text) => {

    text += VerbalizedSampling.getInstruction();
    return {
        text
    };
};
modifier(text);