import styles from "@/[sandbox]/sandbox.scss";
import "@/components/sass-stats/SassStats";
import { ThemeName } from "@/components/theme/Theme";
import reset from "@/wc_scss/reset.scss";
import {
  customElement,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult
} from "lit-element";
import {
  accordionTemplate,
  advanceListTemplate,
  alertBannerTemplate,
  alertTemplate,
  audioPlayerTemplate,
  avatarTemplate,
  badgeTemplate,
  breadcrumbTemplate,
  buttonGroupTemplate,
  buttonTemplate,
  cardAiTemplate,
  cardTemplate,
  chatMessageTemplate,
  checkboxTemplate,
  chipTemplate,
  coachTemplate,
  codeEditorTemplate,
  colorTableTemplate,
  comboBoxTemplate,
  datePickerTemplate,
  dateRangePickerTemplate,
  dateTimePickerTemplate,
  draggableTemplate,
  dropdownTemplate,
  editableField,
  favoriteTemplate,
  floatingModalTemplate,
  formTemplate,
  grabberTemplate,
  iconTemplate,
  inputFileTemplate,
  inputTemplate,
  labelTemplate,
  linkTemplate,
  listTemplate,
  loadingTemplate,
  meetingAlertTemplate,
  menuItemTemplate,
  menuOverlayTemplate,
  modalTemplate,
  paginationTemplate,
  phoneInputTemplate,
  popoverTemplate,
  progressBarTemplate,
  radioGroupTemplate,
  sliderTemplate,
  spinnerTemplate,
  tableAdvancedTemplate,
  tableTemplate,
  tabsTemplate,
  taskItemTemplate,
  timePickerTemplate,
  toggleSwitchTemplate,
  tooltipTemplate
} from "./examples";

@customElement("momentum-ui-web-components-sandbox")
export class Sandbox extends LitElement {
  @property({ type: Boolean })
  darkTheme = false;

  @property({ type: String })
  theme: ThemeName = "lumos";

  @internalProperty()
  private selectedTab = "Accordion";

  connectedCallback(): void {
    super.connectedCallback();
    this.loadSettingsFromStorage();
    console.log("connected");
    this.addEventListener("selected-changed", this.selectedTabChanged as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    console.log("disconnected");
    this.removeEventListener("selected-changed", this.selectedTabChanged as EventListener);
  }

  selectedTabChanged(event: CustomEvent) {
    const { value, tabsOrder } = event.detail;
    const tab = tabsOrder[value];
    this.selectedTab = tab;
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (this.darkTheme) {
      document.body.style.backgroundColor = "#000";
      document.body.style.color = "#fff";
    } else {
      document.body.style.backgroundColor = "#fff";
      document.body.style.color = "#000";
    }
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
  }

  loadSettingsFromStorage() {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      this.theme = storedTheme as ThemeName;
    }

    const storedDarkTheme = localStorage.getItem("darkTheme");
    if (storedDarkTheme) {
      this.darkTheme = JSON.parse(storedDarkTheme);
    }
  }

  toggleSetting(event: MouseEvent) {
    const composedPath = event.composedPath();
    const target = composedPath[0] as unknown as HTMLOrSVGElement;
    const { aspect } = target.dataset;
    if (aspect === "lumos" || aspect === "momentumV2" || aspect === "momentum") {
      this.theme = aspect;
      localStorage.setItem("theme", this.theme);
    } else if (aspect === "darkTheme") {
      this.darkTheme = !this.darkTheme;
      localStorage.setItem("darkTheme", JSON.stringify(this.darkTheme));
    } else {
      console.error("Invalid data-aspect input");
      return;
    }
  }

  themeToggle() {
    return html`
      <div class="toggle-container">
        <label class="switch">
          <input
            type="checkbox"
            id="theme-switch"
            class="theme-switch"
            data-aspect="darkTheme"
            @click=${this.toggleSetting}
            ?checked=${this.darkTheme}
          />
          Dark Mode
        </label>
        <label class="switch">
          <input
            type="radio"
            name="theme-switch"
            class="momentum-switch"
            data-aspect="momentum"
            @click=${this.toggleSetting}
            ?checked=${this.theme === "momentum"}
          />
          Momentum
        </label>
        <label class="switch">
          <input
            type="radio"
            name="theme-switch"
            class="lumos-switch"
            data-aspect="lumos"
            @click=${this.toggleSetting}
            ?checked=${this.theme === "lumos"}
          />
          Lumos
        </label>
        <label class="switch">
          <input
            type="radio"
            name="theme-switch"
            class="momentumv2-switch"
            data-aspect="momentumV2"
            @click=${this.toggleSetting}
            ?checked=${this.theme === "momentumV2"}
          />
          MomentumV2
        </label>
      </div>
    `;
  }

  containerColorOptionTemplate() {
    return html`
      <div class="container-color-bg-color-options">
        <label for="color-dropdown">container color:</label>
        <select id="color-dropdown" name="colors" @change=${this.handleContainerColorChange}>
          <option value="--md-primary-bg-color">--md-primary-bg-color</option>
          <option value="--md-secondary-bg-color">--md-secondary-bg-color</option>
          <option value="--md-primary-gradient-background">--md-primary-gradient-background</option>
          <option value="--md-secondary-gradient-background">--md-secondary-gradient-background</option>
          <option value="--md-secondary-bg-color">--md-secondary-bg-color</option>
          <option value="--md-tertiary-one-bg-color">--md-tertiary-one-bg-color</option>
          <option value="--md-quaternary-bg-color">--md-md-quaternary-bg-color</option>
          <option value="--md-secondary-white-bg-color">--md-secondary-white-bg-color</option>
        </select>
      </div>
    `;
  }

  handleContainerColorChange() {
    const colorDropdown = this.shadowRoot?.getElementById("color-dropdown") as HTMLSelectElement;
    const selectedColor = colorDropdown.value;
    const elements = this.shadowRoot?.querySelectorAll(".container");
    elements?.forEach((element) => {
      const containerElement = element as HTMLElement;
      containerElement.style.background = `var(${selectedColor})`;
    });
  }

  static get styles() {
    return [reset, styles];
  }

  getTabTemplate(
    componentName: string,
    component: string,
    componentSassStatsName: string,
    componentPanelTemplate: TemplateResult
  ) {
    return html`
      <md-tab slot="tab" name=${componentName}>
        <span>${component}</span>
      </md-tab>
      ${this.getComponentTabPanelTemplate(componentName, component, componentSassStatsName, componentPanelTemplate)}
    `;
  }

  getComponentTabPanelTemplate(
    componentName: string,
    component: string,
    componentSassStatsName: string,
    componentPanelTemplate: TemplateResult
  ) {
    return html`
      <md-tab-panel slot="panel">
        <div class="container" aria-label=${component}>
          <h2>${componentName}</h2>
          ${componentName.length !== 0
            ? componentSassStatsName.length !== 0
              ? html`<sass-stats component=${componentSassStatsName}> ${componentPanelTemplate} </sass-stats>`
              : html`${componentPanelTemplate}`
            : html``}
        </div>
      </md-tab-panel>
    `;
  }

  render() {
    return html`
      <md-theme class="theme-toggle" id="app-theme" ?darkTheme=${this.darkTheme} theme=${this.theme}>
        <div class="header-controls">${this.themeToggle()} ${this.containerColorOptionTemplate()}</div>

        <md-tabs direction="vertical" class="explorer" persist-selection tabs-id="explorer">
          ${this.getTabTemplate("Accordion", "md-accordion", "accordion", accordionTemplate)}
          ${this.getTabTemplate("Alert Banner", "md-alert-banner", "alert-banner", alertBannerTemplate)}
          ${this.getTabTemplate("Alert", "md-alert", "alert", alertTemplate)}
          ${this.getTabTemplate("Audio Player", "md-audio-player", "audio-player", audioPlayerTemplate)}
          ${this.getTabTemplate("Avatar", "md-avatar", "avatar", avatarTemplate)}
          ${this.getTabTemplate("Badge", "md-badge", "badge", badgeTemplate)}
          ${this.getTabTemplate("Breadcrumb", "md-breadcrumb", "breadcrumb", breadcrumbTemplate)}
          ${this.getTabTemplate("Button", "md-button", "button", buttonTemplate)}
          ${this.getTabTemplate("Button Group", "md-button-group", "button-group", buttonGroupTemplate)}
          ${this.getTabTemplate("Card", "md-card", "card", cardTemplate)}
          ${this.getTabTemplate("Card - AI", "md-card-ai", "card-ai", cardAiTemplate)}
          ${this.getTabTemplate("Chat Message", "md-chat-message", "chat-message", chatMessageTemplate)}
          ${this.getTabTemplate("Checkbox", "md-checkbox", "checkbox", checkboxTemplate)}
          ${this.getTabTemplate("Chip", "md-chip", "chip", chipTemplate)}
          ${this.getTabTemplate("Coachmark", "md-coachmark", "coachmark", coachTemplate)}
          ${this.getTabTemplate("Code Editor", "md-code-editor", "code-editor", codeEditorTemplate)}
          ${this.getTabTemplate("Combo Box", "md-combobox", "combobox", comboBoxTemplate)}
          ${this.getTabTemplate("Datepicker", "md-datepicker", "datepicker", datePickerTemplate)}
          ${this.getTabTemplate("Date Range Picker", "md-date-range-picker", "datepicker", dateRangePickerTemplate)}
          ${this.getTabTemplate("Date Time Picker", "md-date-time-picker", "date-time-picker", dateTimePickerTemplate)}
          ${this.getTabTemplate("Dropdown", "md-dropdown", "dropdown", dropdownTemplate)}
          ${this.getTabTemplate("Draggable", "md-draggable", "draggable", draggableTemplate)}
          ${this.getTabTemplate("Editable Field", "md-editable-field", "editable-textfield", editableField)}
          ${this.getTabTemplate("Favorite", "md-favorite", "favorite", favoriteTemplate)}
          ${this.getTabTemplate("Floating Modal", "md-floating-modal", "floating-modal", floatingModalTemplate)}
          ${this.getTabTemplate("Form", "md-form", "", formTemplate)}
          ${this.getTabTemplate("Grabber", "md-grabber", "grabber", grabberTemplate)}
          ${this.getTabTemplate("Icon", "md-icon", "icon", iconTemplate)}
          ${this.getTabTemplate("Input", "md-input", "input", inputTemplate)}
          ${this.getTabTemplate("Input File", "md-input-file", "input-file", inputFileTemplate)}
          ${this.getTabTemplate("Label", "md-label", "label", labelTemplate)}
          ${this.getTabTemplate("Link", "md-link", "link", linkTemplate)}
          ${this.getTabTemplate("List", "md-list", "list", listTemplate)}
          ${this.getTabTemplate("Advanced List", "md-advance-list", "list", advanceListTemplate)}
          ${this.getTabTemplate("Loading", "md-loading", "loading", loadingTemplate)}
          ${this.getTabTemplate("Meeting Alert", "md-meeting-alert", "meeting-alert", meetingAlertTemplate)}
          ${this.getTabTemplate("Menu", "md-menu", "menu", menuItemTemplate)}
          ${this.getTabTemplate("Menu Overlay", "md-menu-overlay", "menu-overlay", menuOverlayTemplate)}
          ${this.getTabTemplate("Modal", "md-modal", "modal", modalTemplate)}
          ${this.getTabTemplate("Pagination", "md-pagination", "pagination", paginationTemplate)}
          ${this.getTabTemplate("Phone Input", "md-phone-input", "phone-input", phoneInputTemplate)}
          ${this.getTabTemplate("Popover", "md-popover", "popover", popoverTemplate)}
          ${this.getTabTemplate("Progress Bar", "md-progress-bar", "progress-bar", progressBarTemplate)}
          ${this.getTabTemplate("Radio", "md-radio", "radio", radioGroupTemplate)}
          ${this.getTabTemplate("Slider", "md-slider", "slider", sliderTemplate)}
          ${this.getTabTemplate("Spinner", "md-spinner", "spinner", spinnerTemplate)}
          ${this.getTabTemplate("Table", "md-table", "table", tableTemplate)}
          ${this.getTabTemplate("Table Advanced", "md-table-advanced", "table-advanced", tableAdvancedTemplate)}
          ${this.getTabTemplate("Tabs", "md-tabs", "tabs", tabsTemplate)}
          ${this.getTabTemplate("Task Item", "md-task-item", "taskitem", taskItemTemplate)}
          ${this.getTabTemplate("Timepicker", "md-timepicker", "timepicker", timePickerTemplate)}
          ${this.getTabTemplate("Toggle Switch", "md-toggle-switch", "toggle-switch", toggleSwitchTemplate)}
          ${this.getTabTemplate("Tooltip", "md-tooltip", "tooltip", tooltipTemplate)}
          ${this.getTabTemplate("Colors", "Colors", "", colorTableTemplate)}
        </md-tabs>
      </md-theme>
    `;
  }
}
