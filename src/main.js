import plugin from "../plugin.json";
import TailwindFoldHandler from "./ace-tailwind-fold.js";
const appSettings = acode.require("settings");

class TailwindFold {
    constructor() {
        // Initialize default settings if not present
        if (!appSettings.value[plugin.id]) {
            appSettings.value[plugin.id] = {
                isDisable: false,
                minClasses: 3,
                placeholder: "•••",
                autoFold: true,
                attributes: [],
                //modes: "{}",
            };
            appSettings.update(false);
        }
        this.handleFileSwitch = this.handleFileSwitch.bind(this);
    }

    async init() {
        try {
            if (this.settings.isDisable) return;
            this.initialiseFold();
            editorManager.on("switch-file", this.handleFileSwitch);
        } catch (error) {
            console.error('TailwindFold init error:', error);
        }
    }
    
    handleFileSwitch() {
        this.destroy();
        setTimeout(() => this.initialiseFold(), 100); // Small delay for editor to settle
    }

    initialiseFold() {
        this.tailwindFold = new TailwindFoldHandler(editorManager.editor, {
            minClasses: this.settings.minClasses,
            placeholder: this.settings.placeholder,
            autoFold: this.settings.autoFold,
            attributes: this.settings.attributes,
            //modes: Object.keys(JSON.parse(this.settings.modes)).length > 0 ? JSON.parse(this.settings.modes) : undefined
        });
    }

    async destroy() {
        editorManager.off("switch-file", this.handleFileSwitch);
        
        // Clean up TailwindFoldHandler
        if (this.tailwindFold) {
            this.tailwindFold.destroy();
            this.tailwindFold = null;
        }
    }

    get settingsObj() {
        return {
            list: [
                {
                    key: "isDisable",
                    text: "Disable Tailwind fold",
                    checkbox: !!this.settings.isDisable,
                    info: `Disable Tailwind fold plugin in Acode`,
                },
                {
                    key: "autoFold",
                    text: "Auto Fold",
                    checkbox: !!this.settings.autoFold,
                    info: `Automatically fold classes on cursor movement or editor changes`,
                },
                {
                    key: "minClasses",
                    text: "Minimum classes",
                    value: this.settings.minClasses,
                    info: "Minimum number of classes for folding",
                    prompt: "Minimum classes",
                    promptType: "number",
                    promptOptions: {
                        required: true,
                        test: (value) => value >= 2 && value <= 9,
                    },
                },
                {
                    key: "placeholder",
                    text: "Placeholder",
                    value: this.settings.placeholder,
                    prompt: "Placeholder",
                    promptType: "text",
                    promptOptions: {
                        required: true,
                    },
                },
                {
                    key: "attributes",
                    text: "Custom Attributes",
                    value: this.settings.attributes.map(item => `"${item}"`).join(","),
                    prompt: "Attributes",
                    promptType: "text",
                    promptOptions: {
                        required: true,
                        test: (value) => {
                            if (value.length === 0) {
                                return true;
                            } else {
                                const regex = /^"(?:\w+)"(?:,"(?:\w+)")*$/;
                                return regex.test(value);
                            }
                        },
                    },
                },
                /*{
                    key: "modes",
                    text: "Modes",
                    value: this.settings.modes,
                    prompt: "Modes",
                    promptType: "textarea",
                    info: "Custom mode configuration, check README for more info",
                    promptOptions: {
                        required: true,
                        test: (value) => {
                            try {
                                const parsed = JSON.parse(value);
                                return typeof parsed === "object" && parsed !== null;
                            } catch (e) {
                                return false;
                            }
                        },
                    },
                },*/
            ],
            cb: (key, value) => {
                switch (key) {
                    case "isDisable":
                        if (value) {
                            this.destroy();
                        } else {
                            this.initialiseFold();
                        }
                        break;
                    case "autoFold":
                        if (this.tailwindFold) this.tailwindFold.setOptions({ autoFold: value });
                        break;
                    case "minClasses":
                        if (this.tailwindFold) this.tailwindFold.options.setOptions({ minClasses: value });
                        break;
                    case "placeholder":
                        if (this.tailwindFold) this.tailwindFold.options.setOptions({ placeholder: value });
                        break;
                    case "attributes":
                        if (this.tailwindFold) {
                            value = value.split(',').map(item => item.trim().replace(/^"|"$/g, ''));
                            this.tailwindFold.setOptions({ attributes: value });
                        }
                        break;
                    /*case "modes":
                        if (this.tailwindFold) this.tailwindFold.setOptions({ modes: JSON.parse(value) });
                        break;*/
                }
                this.settings[key] = value;
                appSettings.update();
            },
        };
    }

    get settings() {
        return appSettings.value[plugin.id];
    }
}

if (window.acode) {
    const acodePlugin = new TailwindFold();
    acode.setPluginInit(
        plugin.id,
        async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
            if (!baseUrl.endsWith("/")) {
                baseUrl += "/";
            }
            acodePlugin.baseUrl = baseUrl;
            await acodePlugin.init($page, cacheFile, cacheFileUrl);
        },
        acodePlugin.settingsObj
    );
    acode.setPluginUnmount(plugin.id, () => {
        acodePlugin.destroy();
    });
}
