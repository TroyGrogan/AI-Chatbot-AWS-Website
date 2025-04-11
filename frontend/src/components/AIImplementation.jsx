import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaRobot } from 'react-icons/fa';
import '../styles/Implementation.css';
import PageHeader from './PageHeader';
// Import images from assets
import tensorsMedium from '../assets/Tensors_Medium.png';
import componentsStressTensor from '../assets/Components_stress_tensor.png';
import openchatBenchmark from '../assets/openchat-bench-0106.png';
import transformerArchitecture from '../assets/transformer_architecture-768x1082.png';

const AIImplementation = () => {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate('/about');
    };

    // Ensure the page is scrolled to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="implementation-container" data-type="ai">
            <div className="implementation-header">
                <button 
                    onClick={handleBack} 
                    className="back-button"
                    data-tooltip="Go Back"
                >
                    <FaArrowLeft className="header-icon" />
                </button>
                <div className="implementation-title-container">
                    <h2>
                        <PageHeader type="ai" />
                    </h2>
                </div>
                <div className="right-placeholder"></div>
            </div>

            <div className="implementation-content">
                <section className="implementation-section">
                    <h3>AI Model:</h3>
                    <p>
                        This application uses the open-source language model <a href="https://huggingface.co/openchat/openchat-3.5-0106" target="_blank" rel="noopener noreferrer">OpenChat 3.5-0106</a>, made by OpenChat.
                    </p>
                    
                    <div className="tensor-image-container benchmark-image-container">
                        <a 
                            href="https://huggingface.co/openchat/openchat-3.5-0106#:~:text=Use%20this%20model-,Advancing%20Open%2Dsource%20Language%20Models%20with%20Mixed%2DQuality%20Data,-Online%20Demo%20%7C" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="image-link"
                        >
                            <img src={openchatBenchmark} alt="OpenChat benchmark comparison" className="tensor-image benchmark-image" />
                        </a>
                    </div>
                    
                    <p>
                        From OpenChat's Hugging Face Page:
                    </p>
                    <blockquote>
                        🏆 The Overall Best Performing Open Source 7B Model 🏆<br />
                        🔥 OpenChat-3.5-0106 (7B) now outperforms Grok-0 (33B) on all 4 benchmarks and Grok-1 (314B) on average and 3/4 benchmarks.
                    </blockquote>
                </section>

                <section className="implementation-section">
                    <h3>Model Specifics:</h3>
                    <p>
                        This web application uses a quantized version of the OpenChat 3.5-0106 model, made possible via <a href="https://huggingface.co/TheBloke" target="_blank" rel="noopener noreferrer">TheBloke</a>.
                    </p>
                    <p>
                        <strong>TheBloke</strong> is a prolific contributor on Hugging Face who provides quantized versions of many models (e.g., LLaMA, Qwen, Mistral) in GGUF format, optimized for CPU execution with llama.cpp.
                    </p>
                    <p>
                        The specific model used for this web app is the <a href="https://huggingface.co/TheBloke/openchat-3.5-0106-GGUF?show_file_info=openchat-3.5-0106.Q3_K_M.gguf" target="_blank" rel="noopener noreferrer">TheBloke-openchat-3.5-0106.Q3_K_M.gguf</a> model.
                    </p>
                    <ul>
                        <li>This is the 3-bit quantized, medium sized model version</li>
                        <li>GGUF file size: 3.52 GB</li>
                        <li>GGUF is a format introduced by the llama.cpp team in August 2023, replacing the older GGML format</li>
                    </ul>
                </section>

                <section className="implementation-section">
                    <h3>What is a Quantized AI Model?</h3>
                    <p>
                        A quantized AI model is a version of an AI model where the internal numbers, called weights and activations, are simplified to use less precision. Instead of using detailed, high-precision numbers like 32-bit floating points, these are often converted to lower-precision formats, such as 8-bit integers. This makes the model smaller in size and faster to run, which is great for devices with limited resources, like mobile phones or embedded systems.
                    </p>
                    <h4>How Does It Work?</h4>
                    <p>
                        Think of it like rounding off measurements in a recipe. If a recipe calls for 2.567 cups of flour, you might round it to 2.5 cups to make it easier to measure. In AI models, quantization does something similar: it takes the precise numbers the model uses and approximates them to less precise values, like whole numbers. This reduces the memory needed to store the model and speeds up calculations, especially on hardware that handles simpler numbers better.
                    </p>
                    <h4>What Do Quantized AI Models Bring to the Table?</h4>
                    <p>
                        Quantized AI models bring efficiency to the table. They use less memory, run faster, and consume less power, which can lower costs for deployment. For example, a large language model like Llama 2, which originally needs 138 GB of memory, can be quantized to fit into 40 GB, making it possible to run on a single GPU instead of multiple ones (<a href="https://www.tensorops.ai/post/what-are-quantized-llms" target="_blank" rel="noopener noreferrer">TensorOps AI</a>). This is especially useful for real-world applications where resources are limited, though there might be a small loss in accuracy, which is often acceptable.
                    </p>
                </section>

                <section className="implementation-section">
                    <h3>Enabling Technology: llama.cpp</h3>
                    <p>
                        The AI functionality for this app was made possible through <a href="https://en.wikipedia.org/wiki/Llama.cpp#:~:text=llama.cpp%20is%20an%20open%20source%20software%20library%20that%20performs%20inference%20on%20various%20large%20language%20models%20such%20as%20Llama.%5B3%5D%20It%20is%20co%2Ddeveloped%20alongside%20the%20GGML%20project%2C%20a%20general%2Dpurpose%20tensor%20library." target="_blank" rel="noopener noreferrer">llama.cpp</a>, an open source software library that was co-developed alongside the GGML project.
                    </p>
                    <h4>Who created llama.cpp?</h4>
                    <p>
                        llama.cpp was <strong><u>NOT</u></strong> created by Meta AI. <a href="https://en.wikipedia.org/wiki/Llama.cpp#:~:text=Towards%20the%20end%20of%20September%202022%2C%20Georgi%20Gerganov%20started%20work%20on%20the%20GGML%20library%2C%20a%20C%20library%20implementing%20tensor%20algebra." target="_blank" rel="noopener noreferrer">It was developed by Georgi Gerganov, a software developer, as an open-source project.</a> llama.cpp is a C++ implementation of Meta AI's LLaMA model, designed to run large language models efficiently on various hardware, including systems without powerful GPUs. While it builds on the LLaMA model originally developed by Meta AI, the llama.cpp project itself is an independent effort by Gerganov to make the model more accessible and optimized for local inference.
                    </p>
                    <p>
                        In particular, this app uses the <a href="https://github.com/abetlen/llama-cpp-python" target="_blank" rel="noopener noreferrer">llama-cpp-python</a> library, which provides Python bindings for llama.cpp.
                    </p>
                    <p>
                        From llama.cpp's Github:
                    </p>
                    <blockquote>
                        <a href="https://github.com/ggml-org/llama.cpp#:~:text=The%20main%20goal%20of%20llama.cpp%20is%20to%20enable%20LLM%20inference%20with%20minimal%20setup%20and%20state%2Dof%2Dart%20performance%20on%20a%20wide%20range%20of%20hardware%20%2D%20locally%20and%20in%20the%20cloud." target="_blank" rel="noopener noreferrer"><i>"The main goal of llama.cpp is to enable LLM inference with minimal setup and state-of-the-art performance on a wide range of hardware - locally and in the cloud."</i></a>
                    </blockquote>
                </section>

                <section className="implementation-section">
                    <h3>AI Inference Explained</h3>
                    <p>
                        An AI performing <a href="https://en.wikipedia.org/wiki/Inference_engine#:~:text=In%20the%20field%20of%20artificial%20intelligence%2C%20an%20inference%20engine%20is%20a%20software%20component%20of%20an%20intelligent%20system%20that%20applies%20logical%20rules%20to%20the%20knowledge%20base%20to%20deduce%20new%20information." target="_blank" rel="noopener noreferrer">"inference"</a> means that it is in action, responding to the input, applying a set of logical rules based on the <a href="https://en.wikipedia.org/wiki/Knowledge_base#:~:text=In%20computer%20science%2C%20a%20knowledge%20base%20(KB)%20is%20a%20set%20of%20sentences%2C%20each%20sentence%20given%20in%20a%20knowledge%20representation%20language%2C%20with%20interfaces%20to%20tell%20new%20sentences%20and%20to%20ask%20questions%20about%20what%20is%20known%2C" target="_blank" rel="noopener noreferrer">knowledge base</a> (a <a href="https://en.wikipedia.org/wiki/Set_(mathematics)" target="_blank" rel="noopener noreferrer">set</a> of sentences) it was trained off of, and then the AI will output completely new information (sentences) based on the input it was given and in how it was trained.
                    </p>
                    <blockquote>
                        <a href="https://en.wikipedia.org/wiki/Inference_engine#:~:text=The%20knowledge%20base%20stored%20facts%20about%20the%20world.%20The%20inference%20engine%20applied%20logical%20rules%20to%20the%20knowledge%20base%20and%20deduced%20new%20knowledge." target="_blank" rel="noopener noreferrer"><i>"The knowledge base stores facts about the world. The inference engine applies logical rules to the knowledge base and deduces new knowledge."</i></a>
                    </blockquote>
                    <p>
                        The AI model's inference is done through the <a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener noreferrer">Transformer Architecture</a>, which has been the cornerstone technology for the AI boom of today. <a href="https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)#:~:text=Transformers%20were%20first,representations%20from%20transformers)." target="_blank" rel="noopener noreferrer">This is what allows for technologies like chatGPT (Generative Pre-Trained Transformer) to exist.</a>
                    </p>
                    
                    <div className="tensor-image-container transformer-image-container">
                        <a 
                            href="https://arxiv.org/pdf/1706.03762" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="image-link"
                        >
                            <img src={transformerArchitecture} alt="Transformer Architecture" className="tensor-image transformer-image" />
                        </a>
                    </div>
                    
                    <p>
                        In particular, this app uses the <a href="https://github.com/marella/ctransformers" target="_blank" rel="noopener noreferrer">ctransformers</a> library, which provides Python bindings for transformer models.
                    </p>
                </section>

                <section className="implementation-section">
                    <h3>What is the GGML Project?</h3>
                    <p>
                        The <a href="https://github.com/ggerganov/ggml" target="_blank" rel="noopener noreferrer">GGML</a> library is a general purpose C library that implements tensor algebra, which is essential for machine learning.
                    </p>
                    <blockquote>
                        <a href="https://en.wikipedia.org/wiki/Tensor_(machine_learning)#:~:text=In%20machine%20learning%2C%20the%20term%20tensor%20informally%20refers%20to%20two%20different%20concepts%20(i)%20a%20way%20of%20organizing%20data%20and%20(ii)%20a%20multilinear%20(tensor)%20transformation." target="_blank" rel="noopener noreferrer"><i>"In machine learning, the term tensor informally refers to two different concepts (i) a way of organizing data and (ii) a multilinear (tensor) transformation."</i></a>
                    </blockquote>
                    <p>
                        In other words, tensors are the mathematical, algebraic tool that allows for the information to be stored and to be generated from.
                    </p>
                </section>

                <section className="implementation-section">
                    <h3>Understanding Tensors</h3>
                    <p>
                        Tensors are mathematical objects that generalize scalars, vectors, and matrices to higher dimensions, represented visually as multi-layered grids—like a cube of numbers for a rank-3 tensor—where each layer or entry captures relationships across multiple directions or indices.
                    </p>

                    <div className="tensor-image-container medium-image-container">
                        <a 
                            href="https://medium.com/@er.sumitsah/an-introduction-to-tensors-understanding-the-mathematical-powerhouse-e04f53be9bee#:~:text=In%20the%20world%20of%20mathematics%20and%20data%20analysis%2C%20tensors%20play%20a%20fundamental%20role%20in%20representing%20and%20manipulating%20multi%2Ddimensional%20data.%20From%20physics%20and%20engineering%20to%20deep%20learning%20and%20machine%20learning%2C%20tensors%20provide%20a%20powerful%20framework%20for%20understanding%20complex%20phenomena." 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="image-link"
                        >
                            <img src={tensorsMedium} alt="Tensor visualization" className="tensor-image tensor-medium" />
                        </a>
                    </div>

                    <p>
                        For reference, the rank of a tensor refers to the tensor's number of axes.
                    </p>
                    <p>
                        Examples:
                    </p>
                    <ul>
                        <li>The rank of a vector is 1 because it has a single axis.</li>
                        <li>The rank of a matrix is 2 because it has two axes.</li>
                    </ul>

                    <div className="tensor-image-container wiki-image-container">
                        <a 
                            href="https://en.wikipedia.org/wiki/Tensor#:~:text=Tensors%20have%20become,simply%20called%20%22tensors%22." 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="image-link"
                        >
                            <img src={componentsStressTensor} alt="Stress tensor components" className="tensor-image tensor-wiki" />
                        </a>
                    </div>

                    <p>
                        This multidimensionality allows tensors to model complex data, such as the stress in a material or the curvature of space-time, by organizing numbers across several dimensions to represent interactions in a structured way.
                    </p>
                    <p>
                        Looking into the future, tensor cores are now becoming a larger and larger component of computer graphics, and is the central component of AI-based GPUs, like NVIDIA's CUDA GPUs.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default AIImplementation; 