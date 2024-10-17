/**
 * Copyright (c) Cisco Systems, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import "@/components/icon/Icon";
import "@/components/menu-overlay/MenuOverlay";
import { Key } from "@/constants";
import { customElementWithCheck, ResizeMixin, RovingTabIndexMixin, SlottedMixin } from "@/mixins";
import reset from "@/wc_scss/reset.scss";
import { html, internalProperty, LitElement, property, PropertyValues, query, queryAll } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import { repeat } from "lit-html/directives/repeat";
import { styleMap } from "lit-html/directives/style-map";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
import { nanoid } from "nanoid";
import Sortable from "sortablejs";
import { setTimeout } from "timers";
import { MenuOverlay } from "../menu-overlay/MenuOverlay"; // Keep type import as a relative path
import styles from "./scss/module.scss";
import { Tab, TAB_CROSS_WIDTH, TabClickEvent, TabCloseClickEvent } from "./Tab";
import { TabPanel } from "./TabPanel";

const MORE_MENU_TAB_TRIGGER_ID = "tab-more";
const MORE_MENU_WIDTH = "226px"; // Designed width
const MORE_MENU_HEIGHT = "288px"; // Designed height

export const MORE_MENU_TAB_COPY_ID_PREFIX = "more-menu-copy-";
const VISIBLE_TO_VISIBLE = "visibleToVisible";
const VISIBLE_TO_HIDDEN = "visibleToHidden";
const HIDDEN_TO_VISIBLE = "hiddenToVisible";
const HIDDEN_TO_HIDDEN = "hiddenToHidden";
const PREVIOUS = "previous";
const NEXT = "next";
const FROM_MORE_TABS = "fromMoreTabs";
export namespace Tabs {
  type TabViewportData = {
    isTabInViewportHidden: boolean;
    tabOffsetWidth: number;
  };
  type TabsViewportDataList = TabViewportData[];

  type TabId = Element["id"];
  export type TabsType = "Line" | "Pill";

  @customElementWithCheck("md-tabs")
  export class ELEMENT extends ResizeMixin(RovingTabIndexMixin(SlottedMixin(LitElement))) {
    @property({ type: Boolean }) justified = false;
    @property({ type: String }) overflowLabel = "More Tabs";
    @property({ type: Boolean, attribute: "draggable" }) draggable = false;
    @property({ type: String }) direction: "horizontal" | "vertical" = "horizontal";
    @property({ type: Number, attribute: "more-items-scroll-limit" }) moreItemsScrollLimit = Number.MAX_SAFE_INTEGER;

    @property({ type: Number }) delay = 0;
    @property({ type: Number }) animation = 100;
    @property({ type: String, attribute: "ghost-class" }) ghostClass = "";
    @property({ type: String, attribute: "chosen-class" }) chosenClass = "";
    @property({ type: Boolean, attribute: "force-fallback" }) forceFallback = false;
    @property({ type: String, attribute: "fallback-class" }) fallbackClass = "";

    // tabsId and persistSelection attributes are used to persist the selection of tab on remount of md-tabs component
    @property({ type: String, attribute: "tabs-id" }) tabsId = "";
    @property({ type: Boolean, attribute: "persist-selection" }) persistSelection = false;
    @property({ type: String, attribute: "comp-unique-id" }) compUniqueId = "";
    @property({ type: String }) type: Tabs.TabsType = "Line";
    @property({ type: Boolean }) newMomentum = false;

    @internalProperty() private isMoreTabMenuVisible = false;
    @internalProperty() private isMoreTabMenuMeasured = false;
    @internalProperty() private isMoreTabMenuOpen = false;
    @internalProperty() private isMoreTabMenuSelected = false;
    @internalProperty() private isMoreTabMenuScrollable = false;
    @internalProperty() private moreTabMenuOffsetWidth = 0;
    @internalProperty() private moreTabMenuMaxHeight: string | null = null;
    @internalProperty() private tabsViewportDataList: TabsViewportDataList = [];
    @internalProperty() private tabsFilteredAsVisibleList: Tab.ELEMENT[] = [];
    @internalProperty() private tabsFilteredAsHiddenList: Tab.ELEMENT[] = [];
    @internalProperty() private noTabsVisible = false;
    @internalProperty() private defaultTabsOrderArray: string[] = [];
    @internalProperty() private tabsOrderPrefsArray: string[] = [];

    @query("slot[name='tab']") tabSlotElement!: HTMLSlotElement;
    @query("slot[name='panel']") panelSlotElement?: HTMLSlotElement;
    @query(".md-tab__list[part='tabs-list']") tabsListElement?: HTMLDivElement;
    @query(".md-tabs__settings[part='md-tabs__settings']") tabsSettingsElement?: HTMLElement;
    @query(".md-menu-overlay__more_tab") moreTabMenuElement?: Tab.ELEMENT;
    @query("md-menu-overlay") menuOverlayElement?: MenuOverlay.ELEMENT;

    @query(".md-tab__list[part='tabs-more-list']") tabsMoreListElement?: HTMLDivElement;
    @queryAll(".md-menu-overlay__more_list md-tab") tabsCopyHiddenListElements?: NodeListOf<Tab.ELEMENT>;

    @query("#visible-tabs-list") visibleTabsContainerElement?: HTMLElement;
    @query("#tabs-more-list") hiddenTabsContainerElement?: HTMLElement;

    private generateOptions() {
      return {
        group: "shared",
        animation: 10,
        swapThreshold: 1,
        draggable: "md-tab",
        direction: this.direction,
        forceFallback: this.forceFallback,
        fallbackClass: this.fallbackClass,
        ghostClass: this.ghostClass,
        chosenClass: this.chosenClass,
        onEnd: this.handleOnDragEnd
      };
    }

    private tabs: Tab.ELEMENT[] = [];
    private panels: TabPanel.ELEMENT[] = [];

    private tabsCopy: Tab.ELEMENT[] = [];

    private tabsHash: Record<TabId, Tab.ELEMENT> = {};
    private tabsCopyHash: Record<TabId, Tab.ELEMENT> = {};

    private tabsIdxHash: Record<TabId, number> = {};

    private tabsVisibleIdxHash: Record<TabId, number> = {};
    private tabsHiddenIdxHash: Record<TabId, number> = {};
    private tabHiddenIdPositiveTabIndex?: TabId;

    private visibleTabsSortableInstance: Sortable | null = null;
    private hiddenTabsSortableInstance: Sortable | null = null;

    private getCopyTabId(tab: Tab.ELEMENT) {
      if (tab.id?.startsWith(MORE_MENU_TAB_COPY_ID_PREFIX)) {
        return `${MORE_MENU_TAB_COPY_ID_PREFIX}${tab.id}`;
      } else {
        return tab.id;
      }
    }

    private getAriaControlId(tab: Tab.ELEMENT) {
      if (tab.id?.startsWith(MORE_MENU_TAB_COPY_ID_PREFIX)) {
        return `${MORE_MENU_TAB_COPY_ID_PREFIX}${tab.id}`;
      } else {
        const uniqueId = tab.id?.substring(4);
        const panelId = "tab_panel_" + uniqueId;
        return panelId;
      }
    }

    private getTabIndex(tab: Tab.ELEMENT) {
      // Get first tabindex to 0 only when More button is there and the visible tab is not selected
      if (
        this.isMoreTabMenuVisible &&
        this.getCurrentIndex(tab?.id) === 0 &&
        this.selected > this.tabsFilteredAsVisibleList?.length - 1
      ) {
        return 0;
      } else if (this.tabsFilteredAsVisibleList[this.selected]?.id === tab.id) {
        return 0;
      } else {
        return -1;
      }
    }

    private getNormalizedTabId(id: TabId) {
      return id.replace(MORE_MENU_TAB_COPY_ID_PREFIX, "");
    }

    static get styles() {
      return [reset, styles];
    }

    private async ensureTabsUpdateComplete(tabs: Tab.ELEMENT[]) {
      const tabUpdatesCompletesPromises = tabs
        .map((tab) => {
          if (typeof tab.updateComplete !== "undefined") {
            return tab.updateComplete;
          }
          return null;
        })
        .filter((promise) => promise !== null);

      tabUpdatesCompletesPromises.length && (await Promise.all(tabUpdatesCompletesPromises));
    }

    // This operation may affect render performance when using frequently. Use careful!
    private measureTabsOffsetWidth() {
      return !this.justified && this.direction !== "vertical"
        ? this.tabs.map((tab) => {
            return tab.closable ? tab.offsetWidth + TAB_CROSS_WIDTH : tab.offsetWidth;
          })
        : this.tabs.map((tab) => {
            tab.setAttribute("measuringrealwidth", "");
            const offsetWidth = tab.closable ? tab.offsetWidth + TAB_CROSS_WIDTH : tab.offsetWidth;
            tab.removeAttribute("measuringrealwidth");
            return offsetWidth;
          });
    }

    private measureHiddenTabsCopiesOffsetHeight() {
      return this.tabsCopy.map((tab) => tab.offsetHeight);
    }

    private async manageOverflow() {
      if (this.direction !== "vertical") {
        let tabList;
        if (this.tabsFilteredAsVisibleList.length === 0 && this.tabsFilteredAsHiddenList.length === 0) {
          tabList = [...this.tabs];
        } else {
          tabList = [...this.tabsFilteredAsVisibleList, ...this.tabsFilteredAsHiddenList];
        }

        tabList.forEach((tab) => {
          if (tab.children?.length && tab.children[0]?.children?.length === 0) {
            const slotHeaderNode = tab?.querySelector("slot")?.assignedNodes({ flatten: true })[0].cloneNode(true);
            if (slotHeaderNode) {
              (slotHeaderNode as HTMLElement).classList.add("tab-content");
              tab?.children[0]?.appendChild(slotHeaderNode);
            }
          }
        });

        const tabsCount = tabList.length;
        if (this.tabsListElement && tabsCount) {
          const tabsListViewportOffsetWidth = this.tabsSettingsElement?.offsetWidth
            ? this.tabsListElement.offsetWidth - this.tabsSettingsElement?.offsetWidth
            : this.tabsListElement.offsetWidth;
          await this.ensureTabsUpdateComplete(this.tabs);

          const tabsOffsetsWidths = this.measureTabsOffsetWidth();

          // All tabs total offsetsWidth
          const tabsTotalOffsetWidth = tabList.reduce((acc, tab, idx) => {
            acc += tabsOffsetsWidths[idx];
            return acc;
          }, 0);

          if (tabsTotalOffsetWidth) {
            // more
            await this.setupMoreTab();

            let isTabsFitInViewport = true;
            if (tabsListViewportOffsetWidth < tabsTotalOffsetWidth) {
              // console.log("Applied More button");
              isTabsFitInViewport = false;
            } else {
              // console.log("Removed More button");
            }

            const newTabsViewportList: TabsViewportDataList = [];
            let tabsOffsetWidthSum = 0;
            tabList.forEach((tab, idx) => {
              tabsOffsetWidthSum += tabsOffsetsWidths[idx];

              const isTabInViewportHidden = isTabsFitInViewport
                ? false
                : tabsOffsetWidthSum + (idx < tabsCount - 1 ? this.moreTabMenuOffsetWidth : 0) >
                  tabsListViewportOffsetWidth;

              newTabsViewportList.push({
                isTabInViewportHidden: isTabInViewportHidden,
                tabOffsetWidth: tabsOffsetsWidths[idx]
              });
            });

            this.tabsViewportDataList = newTabsViewportList;

            // Make real tabs viewportHidden update
            this.tabsViewportDataList.forEach(
              (tvd, idx) => (this.tabs[idx].viewportHidden = tvd.isTabInViewportHidden)
            );

            // Make more button hidden update
            this.isMoreTabMenuVisible = !!this.tabsViewportDataList.find((tvd) => tvd.isTabInViewportHidden);

            // Only tabs going visible
            this.tabsFilteredAsVisibleList = tabList.filter(
              (t, idx) => !this.tabsViewportDataList[idx].isTabInViewportHidden
            );
            this.tabsVisibleIdxHash = this.tabsFilteredAsVisibleList.reduce(
              (acc, tab, idx) => {
                acc[tab.id] = idx;
                return acc;
              },
              {} as Record<TabId, number>
            );

            // Only tabs going hidden
            this.tabsFilteredAsHiddenList = tabList.filter(
              (t, idx) => this.tabsViewportDataList[idx].isTabInViewportHidden
            );
            this.tabsHiddenIdxHash = this.tabsFilteredAsHiddenList.reduce(
              (acc, tab, idx) => {
                acc[tab.id] = idx;
                return acc;
              },
              {} as Record<TabId, number>
            );
          }
        }

        this.updateIsMoreTabMenuSelected();

        const firstNotDisabledHiddenTab = this.tabsFilteredAsHiddenList.find((t) => !t.disabled);
        this.updateHiddenIdPositiveTabIndex(firstNotDisabledHiddenTab);
      }
    }

    private updateIsMoreTabMenuSelected() {
      // More menu selected check
      this.isMoreTabMenuSelected = !!this.tabsFilteredAsHiddenList.find((tab) => tab.selected);
    }

    private updateHiddenIdPositiveTabIndex(hiddenTab?: Tab.ELEMENT) {
      this.tabHiddenIdPositiveTabIndex = hiddenTab ? hiddenTab.id : undefined;
    }

    /* Sort tabs and panes as per the user prefs saved in the localStorage */
    private sortTabsAndPanes() {
      if (!this.tabsOrderPrefsArray.length) {
        return;
      }

      const comparator = (a: Tab.ELEMENT | TabPanel.ELEMENT, b: Tab.ELEMENT | TabPanel.ELEMENT) => {
        const aName = a.getAttribute("name") || "";
        const bName = b.getAttribute("name") || "";
        return this.tabsOrderPrefsArray.indexOf(aName) - this.tabsOrderPrefsArray.indexOf(bName);
      };

      this.tabs.sort(comparator);
      this.panels.sort(comparator);
    }

    private async linkPanelsAndTabs() {
      this.sortTabsAndPanes(); /* Apply sorting on tabs and panes before linking */

      const { tabs, panels } = this;

      if (tabs.length === 0 || panels.length === 0) {
        console.warn(`The tabs or panels count should't be equal zero.`);
        return;
      }

      if (tabs.length !== panels.length) {
        console.warn(`The amount of tabs (${tabs.length}) doesn't match the amount of panels (${panels.length}).`);
      }

      tabs.forEach((tab, index) => {
        const uniqueId = nanoid(10);
        const tabId = "tab_" + uniqueId;
        const panelId = "tab_panel_" + uniqueId;
        tab.setAttribute("id", tabId);
        tab.setAttribute("aria-controls", panelId);
        tab.selected = this.selected === index;

        if (this.direction === "vertical") {
          tab.vertical = true;
        }

        const panel = panels[index];

        if (panel) {
          panel.setAttribute("id", panelId);
          panel.setAttribute("aria-labelledby", tabId);
          panel.selected = this.selected === index;
          if (tab.disabled) {
            panel.hidden = true;
            panel.selected = false;
          }
        } else {
          tab.disabled = true;
        }
      });

      let selectedIndex = this.selected;
      while (selectedIndex < tabs.length && tabs[selectedIndex].disabled) {
        selectedIndex++;
      }
      selectedIndex = selectedIndex === tabs.length ? 0 : selectedIndex;
      tabs[selectedIndex].selected = true;
      panels[selectedIndex].selected = true;

      this.tabsHash = this.tabs.reduce(
        (acc, tab) => {
          acc[tab.id] = tab;
          return acc;
        },
        {} as Record<TabId, Tab.ELEMENT>
      );

      this.tabsIdxHash = this.tabs.reduce(
        (acc, tab, idx) => {
          acc[tab.id] = idx;
          return acc;
        },
        {} as Record<TabId, number>
      );
    }

    get slotItem() {
      return this.tabSlotElement;
    }

    protected filterSlotted() {
      return this.tabSlotElement.assignedElements() as HTMLElement[];
    }

    protected async handleResize(contentRect: DOMRect) {
      super.handleResize && super.handleResize(contentRect);
      await this.manageOverflow();
    }

    private getDragDirection(event: Sortable.SortableEvent) {
      if (event.from === this.visibleTabsContainerElement && event.to === this.hiddenTabsContainerElement) {
        return VISIBLE_TO_HIDDEN;
      } else if (event.from === this.visibleTabsContainerElement && event.to === this.visibleTabsContainerElement) {
        return VISIBLE_TO_VISIBLE;
      } else if (event.from === this.hiddenTabsContainerElement && event.to === this.visibleTabsContainerElement) {
        return HIDDEN_TO_VISIBLE;
      } else if (event.from === this.hiddenTabsContainerElement && event.to === this.hiddenTabsContainerElement) {
        return HIDDEN_TO_HIDDEN;
      }
    }

    public handleOnDragEnd = async (event: Sortable.SortableEvent) => {
      event.stopPropagation();
      const oldIndex = event.oldIndex;
      const newIndex = event.newIndex;

      const visibleTabElements = [...this.tabsFilteredAsVisibleList];
      const hiddenTabElements = [...this.tabsFilteredAsHiddenList];

      const dragDirection = this.getDragDirection(event);

      if (oldIndex === undefined || newIndex === undefined) return;

      switch (dragDirection) {
        case VISIBLE_TO_HIDDEN: {
          this.hiddenTabsContainerElement?.querySelector("#" + event.item.id)?.remove();
          const draggedElement = visibleTabElements[oldIndex];
          const autoMoveElement = hiddenTabElements.slice(-1)[0];
          const updatedDraggedToIndex = newIndex === this.tabsFilteredAsHiddenList.length ? newIndex - 1 : newIndex;
          hiddenTabElements.splice(updatedDraggedToIndex, 0, draggedElement);
          hiddenTabElements.pop();

          const filteredVisibleTabElements = visibleTabElements.filter((element: HTMLElement) => {
            return element.id !== this.getNormalizedTabId(event.item.id);
          });
          filteredVisibleTabElements.push(autoMoveElement);
          this.tabsFilteredAsVisibleList = [...filteredVisibleTabElements];
          this.tabsFilteredAsHiddenList = [...hiddenTabElements];
          break;
        }
        case VISIBLE_TO_VISIBLE: {
          const draggedElement = visibleTabElements[oldIndex];
          visibleTabElements.splice(oldIndex, 1);
          visibleTabElements.splice(newIndex, 0, draggedElement);
          this.tabsFilteredAsVisibleList = visibleTabElements;
          if (newIndex === this.tabsFilteredAsVisibleList.length - 1) {
            this.visibleTabsContainerElement?.children[this.visibleTabsContainerElement.children.length - 1]?.remove();
          }
          const draggedContainerElement = this.visibleTabsContainerElement!.children[oldIndex];
          const targetContainerElement = this.visibleTabsContainerElement!.children[newIndex];

          if (!draggedContainerElement || !targetContainerElement) {
            return;
          }
          this.visibleTabsContainerElement?.replaceChild(targetContainerElement, draggedContainerElement);
          this.visibleTabsContainerElement?.insertBefore(draggedContainerElement, targetContainerElement);
          break;
        }
        case HIDDEN_TO_VISIBLE: {
          this.visibleTabsContainerElement?.querySelector("#" + event.item.id)?.remove();
          const draggedElement = hiddenTabElements[oldIndex];
          const autoMoveElement = visibleTabElements.slice(-1)[0];
          hiddenTabElements.splice(oldIndex, 1);
          hiddenTabElements.splice(0, 0, autoMoveElement);
          const updatedDraggedToIndex = newIndex === this.tabsFilteredAsVisibleList.length ? newIndex - 1 : newIndex;

          visibleTabElements.splice(updatedDraggedToIndex, 0, draggedElement);
          visibleTabElements.pop();

          this.tabsFilteredAsVisibleList = visibleTabElements;
          this.tabsFilteredAsHiddenList = hiddenTabElements;
          break;
        }
        case HIDDEN_TO_HIDDEN: {
          const draggedElement = hiddenTabElements[oldIndex];
          hiddenTabElements.splice(oldIndex, 1);
          hiddenTabElements.splice(newIndex, 0, draggedElement);
          this.tabsFilteredAsHiddenList = hiddenTabElements;
          if (newIndex === this.tabsFilteredAsHiddenList.length - 1) {
            this.hiddenTabsContainerElement?.children[this.hiddenTabsContainerElement.children.length - 1]?.remove();
          }
          break;
        }
      }

      if (this.compUniqueId) {
        const tabsOrder = [...this.tabsFilteredAsVisibleList, ...this.tabsFilteredAsHiddenList];
        const newSelectedIndex = tabsOrder.findIndex((tabItem) => tabItem.selected);
        this.storeSelectedTabIndex(newSelectedIndex);
        this.tabsOrderPrefsArray = tabsOrder.map((tabElement) => tabElement.name);
        localStorage.setItem(this.compUniqueId, this.tabsOrderPrefsArray.join(","));
      }
    };

    private makeTabCopyFocus(tabCopy: Tab.ELEMENT) {
      if (tabCopy) {
        tabCopy.focus();
      }
    }

    handleTabClick(event: CustomEvent<TabClickEvent>) {
      const { id } = event.detail;
      this.handleNewSelectedTab(id);
    }

    handleNewSelectedTab(id: string) {
      const tab = this.tabsHash[this.getNormalizedTabId(id)];
      if (tab && !tab.disabled) {
        const newIndex = this.tabsIdxHash[tab.id];

        if (newIndex !== -1) {
          this.updateSelectedTab(newIndex);
        }

        // Setting up focus for tab copy (hidden menu)
        {
          const tabCopy = this.tabsCopyHash[this.getCopyTabId(tab)];
          tabCopy && this.makeTabCopyFocus(tabCopy);
          this.updateHiddenIdPositiveTabIndex(tab);
        }
      }
    }

    handleTabCrossClick(event: CustomEvent<TabClickEvent>) {
      const { id } = event.detail;
      this.handleTabCloseEvent(id);
    }

    handleTabCloseClick(event: CustomEvent<TabCloseClickEvent>) {
      const { id } = event.detail;
      this.handleTabCloseEvent(id);
    }

    handleTabCloseEvent(id: string) {
      const tab = this.tabsHash[this.getNormalizedTabId(id)];
      if (tab && !tab.disabled && (tab.closable === "auto" || tab.closable === "custom")) {
        const crossTabIndex = this.tabsFilteredAsVisibleList.findIndex(
          (element) => this.getNormalizedTabId(element.id) === this.getNormalizedTabId(id)
        );
        this.tabsFilteredAsVisibleList = this.tabsFilteredAsVisibleList.filter((element: HTMLElement) => {
          return this.getNormalizedTabId(element.id) !== this.getNormalizedTabId(id);
        });

        this.visibleTabsContainerElement?.querySelector("#" + id)?.remove();
        if (this.tabsFilteredAsHiddenList.length !== 0) {
          this.tabsFilteredAsVisibleList.push(this.tabsFilteredAsHiddenList[0]);
          this.tabsFilteredAsHiddenList.splice(0, 1);
        }
        if (this.tabsFilteredAsHiddenList.length === 0) {
          this.isMoreTabMenuVisible = false;
          this.isMoreTabMenuMeasured = false;
        }

        this.handleUpdatedSeletedTabAfterCross(crossTabIndex);
      }
    }

    handleUpdatedSeletedTabAfterCross(crossTabIndex: number) {
      let selectedTabPanelIndex = crossTabIndex;
      while (
        selectedTabPanelIndex < this.tabsFilteredAsVisibleList.length &&
        this.tabsFilteredAsVisibleList[selectedTabPanelIndex]?.disabled
      ) {
        selectedTabPanelIndex++;
      }
      if (
        this.tabsFilteredAsVisibleList[selectedTabPanelIndex] === undefined ||
        crossTabIndex === this.tabsFilteredAsVisibleList.length
      ) {
        selectedTabPanelIndex = crossTabIndex - 1;
        while (selectedTabPanelIndex >= 0 && this.tabsFilteredAsVisibleList[selectedTabPanelIndex].disabled) {
          selectedTabPanelIndex--;
        }
      }
      if (selectedTabPanelIndex !== -1) {
        const newSelectedIndex = this.tabs.findIndex(
          (element) => element.id === this.tabsFilteredAsVisibleList[selectedTabPanelIndex].id
        );
        this.updateSelectedTab(newSelectedIndex);
      } else {
        this.updateSelectedTab(selectedTabPanelIndex);
      }
      this.noTabsVisible =
        this.tabsFilteredAsVisibleList.length === 0 && this.tabsFilteredAsHiddenList.length === 0 ? true : false;
      this.requestUpdate();
    }

    private updateSelectedTab(newSelectedIndex: number) {
      const { tabs, panels } = this;
      const oldSelectedIndex = this.tabs.findIndex((element) => element.hasAttribute("selected"));

      if (tabs && panels) {
        [oldSelectedIndex, newSelectedIndex].forEach((index) => {
          const tab = tabs[index];
          tab && tab.toggleAttribute("selected");
          const panel = panels[index];
          panel && panel.toggleAttribute("selected");
          if (tab) {
            const tabCopy = this.tabsCopyHash[this.getCopyTabId(tab)];
            if (tabCopy) {
              tabCopy.toggleAttribute("selected");
              this.isMoreTabMenuSelected = true;
            } else {
              this.isMoreTabMenuSelected = false;
            }
          }
        });
      }

      if (newSelectedIndex >= 0) {
        this.dispatchSelectedChangedEvent(newSelectedIndex);
        const currentTabsConfiguration =
          this.direction === "horizontal"
            ? [...this.tabsFilteredAsVisibleList, ...this.tabsFilteredAsHiddenList]
            : this.tabs;
        const newSelectedTabIdx = currentTabsConfiguration.findIndex(
          (element) => element.id === tabs[newSelectedIndex].id
        );
        this.changeSelectedTabIdx(newSelectedTabIdx);
      }
    }

    private dispatchSelectedChangedEvent(newSelectedIndex: number) {
      const currentTabsOrder =
        this.direction === "horizontal"
          ? [...this.tabsFilteredAsVisibleList, ...this.tabsFilteredAsHiddenList]
          : this.tabs;
      const newSelectedTabId = this.tabs[newSelectedIndex].id;
      const newIndex = currentTabsOrder.findIndex((element) => element.id === newSelectedTabId);

      const newTabArrangement: string[] = [];
      currentTabsOrder.forEach((tabElement) => {
        newTabArrangement.push(tabElement.name);
      });

      this.dispatchEvent(
        new CustomEvent("selected-changed", {
          detail: {
            value: newIndex,
            tabsOrder: newTabArrangement
          },
          composed: true,
          bubbles: true
        })
      );
    }

    private changeSelectedTabIdx(newSelectedTabIdx: number) {
      this.requestUpdate();
      this.selected = newSelectedTabIdx;
      this.updateComplete.then(() => {
        if (newSelectedTabIdx < this.tabsFilteredAsVisibleList.length) {
          const selectedVisibleTab = this.visibleTabsContainerElement?.children[this.selected] as HTMLElement;
          selectedVisibleTab?.focus();
        } else {
          const hiddenTabIdx = this.selected - this.tabsFilteredAsVisibleList.length;
          const selectedHiddenTab = this.hiddenTabsContainerElement?.children[hiddenTabIdx] as HTMLElement;
          this.moveFocusToTab(selectedHiddenTab);
          const newHiddenTab = this.tabsFilteredAsHiddenList[hiddenTabIdx];
          !newHiddenTab?.disabled && this.updateHiddenIdPositiveTabIndex(newHiddenTab);
        }
      });
      this.updateIsMoreTabMenuSelected();
      this.storeSelectedTabIndex(newSelectedTabIdx);
    }

    storeSelectedTabIndex(index: number) {
      if (this.persistSelection && this.tabsId && index > -1 && this.tabsId.trim() !== "") {
        sessionStorage.setItem(this.tabsId, `${index}`);
      }
    }

    private getCurrentIndex(tabId: string) {
      const arrayLength = this.visibleTabsContainerElement?.children.length || 0;
      for (let i = 0; i < arrayLength; i++) {
        if (this.visibleTabsContainerElement?.children[i].id === tabId) {
          return i;
        }
      }
      return this.tabsVisibleIdxHash[tabId];
    }

    private moveFocusToAdjacentTab(elementId: string, direction: "previous" | "next" | "fromMoreTabs") {
      const currentTabIndex = this.getCurrentIndex(elementId);
      const visibleTabs = this.visibleTabsContainerElement?.children;
      const visibleArrayLength = visibleTabs?.length || 0;

      if (!visibleTabs || visibleArrayLength === 0) return;

      let newIndex = 0;

      if (direction === PREVIOUS) {
        newIndex = currentTabIndex === 0 ? visibleArrayLength - 1 : currentTabIndex - 1;
      } else if (direction === NEXT) {
        newIndex = currentTabIndex === visibleArrayLength - 1 ? 0 : currentTabIndex + 1;
      } else if (direction === FROM_MORE_TABS) {
        newIndex = this.selected >= visibleArrayLength ? 0 : this.selected;
      }

      this.moveFocusToTab(visibleTabs[newIndex]);
    }

    moveFocusToTab(tabElement: Element | undefined) {
      setTimeout(() => (tabElement as HTMLElement)?.focus(), 0);
    }

    handleOverlayClose() {
      if (this.menuOverlayElement) {
        this.menuOverlayElement.isOpen = false;
      }
    }

    dispatchKeydownEvent(event: KeyboardEvent, tabId: string) {
      if (tabId) {
        this.dispatchEvent(
          new CustomEvent("tab-keydown", {
            detail: {
              id: tabId,
              key: event.code,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
              srcEvent: event
            },
            bubbles: true,
            composed: true
          })
        );
      }
    }

    handleTabKeydown(event: any) {
      let elementId;

      if (event.target != this && !this.tabs.find((tab) => tab.id === event.target.id)) {
        return false;
      }

      if (event.path) {
        elementId = event.path[0].id;
      } else {
        elementId = event.composedPath() ? event.composedPath()[0].id : event.originalTarget.id;
      }
      const id = this.getNormalizedTabId(elementId);
      this.dispatchKeydownEvent(event, id);

      const key = event.code;
      const { shiftKey } = event;

      const isMoreTriggerTab = this.isMoreTabMenuVisible ? id === MORE_MENU_TAB_TRIGGER_ID : false;

      const tab =
        !isMoreTriggerTab || !this.isMoreTabMenuVisible
          ? this.tabsHash[this.getNormalizedTabId(id)]
          : this.moreTabMenuElement;

      const isVisibleTab = this.isMoreTabMenuVisible ? tab && this.tabsVisibleIdxHash[tab.id] > -1 : true;
      const isHiddenTab = this.isMoreTabMenuVisible ? tab && this.tabsHiddenIdxHash[tab.id] > -1 : false;
      const firstVisibleTabIdx = 0;
      const lastVisibleTabIdx = this.isMoreTabMenuVisible
        ? this.tabsFilteredAsVisibleList.length - 1
        : this.tabs.length - 1;
      const firstHiddenTabIdx = this.isMoreTabMenuVisible ? this.tabsFilteredAsVisibleList.length : -1;
      const lastHiddenTabIdx = this.isMoreTabMenuVisible
        ? this.tabsFilteredAsVisibleList.length + this.tabsFilteredAsHiddenList.length - 1
        : -1;

      switch (key) {
        case Key.Tab: {
          if (isMoreTriggerTab) {
            // Support Shift + Tab from More to last visible tab
            if (!this.isMoreTabMenuOpen && shiftKey) {
              event.preventDefault();
              this.moveFocusToAdjacentTab(elementId, FROM_MORE_TABS);
            }
          } else if (isVisibleTab) {
            //
          } else if (isHiddenTab) {
            //
          }
          break;
        }
        case Key.End: {
          if (isMoreTriggerTab) {
            //
          } else if (isVisibleTab) {
            event.preventDefault();
            this.moveFocusToTab(this.visibleTabsContainerElement?.children[this.tabsFilteredAsVisibleList?.length - 1]);
          } else if (this.isMoreTabMenuOpen) {
            event.preventDefault();
            this.moveFocusToTab(this.hiddenTabsContainerElement?.children[this.tabsFilteredAsHiddenList?.length - 1]);
          }
          break;
        }
        case Key.Home: {
          if (isVisibleTab) {
            event.preventDefault();
            this.moveFocusToTab(this.visibleTabsContainerElement?.children[0]);
          } else if (this.isMoreTabMenuOpen) {
            event.preventDefault();
            this.moveFocusToTab(this.hiddenTabsContainerElement?.children[0]);
          }
          break;
        }
        case Key.ArrowLeft: {
          if (isMoreTriggerTab) {
            //
          } else if (isVisibleTab) {
            event.stopPropagation();
            this.moveFocusToAdjacentTab(elementId, PREVIOUS);
          } else if (isHiddenTab) {
            //
          }
          break;
        }
        case Key.ArrowRight: {
          if (isMoreTriggerTab) {
            //
          } else if (isVisibleTab) {
            event.stopPropagation();
            this.moveFocusToAdjacentTab(elementId, NEXT);
          } else if (isHiddenTab) {
            //
          }
          break;
        }
        case Key.ArrowUp: {
          if (isMoreTriggerTab) {
            //
          } else if (isVisibleTab && this.direction === "vertical") {
            event.preventDefault();
            this.changeSelectedTabIdx(this.selected === firstVisibleTabIdx ? lastVisibleTabIdx : this.selected - 1);
          } else if (isHiddenTab) {
            event.preventDefault();
            const idx = this.selected === firstHiddenTabIdx ? lastHiddenTabIdx : this.selected - 1;
            this.changeSelectedTabIdx(idx);
          }
          break;
        }
        case Key.ArrowDown: {
          if (isMoreTriggerTab) {
            //
          } else if (isVisibleTab && this.direction === "vertical") {
            event.preventDefault();
            this.changeSelectedTabIdx(this.selected === lastVisibleTabIdx ? firstVisibleTabIdx : this.selected + 1);
          } else if (isHiddenTab) {
            event.preventDefault();
            const idx = this.selected === lastHiddenTabIdx ? firstHiddenTabIdx : this.selected + 1;
            this.changeSelectedTabIdx(idx);
          }
          break;
        }
        case Key.Enter:
        case Key.NumpadEnter:
        case Key.Space: {
          if (isMoreTriggerTab) {
            const tabsFilteredAsHiddenNonDisabledList = this.tabsFilteredAsHiddenList.filter((t) => !t.disabled);
            const t = tabsFilteredAsHiddenNonDisabledList.length
              ? tabsFilteredAsHiddenNonDisabledList.find((t) => t.selected) || tabsFilteredAsHiddenNonDisabledList[0]
              : undefined;
            this.updateHiddenIdPositiveTabIndex(t);
            if (t) {
              const idx = this.tabsIdxHash[this.getNormalizedTabId(t.id)];
              if (idx !== -1) {
                this.updateSelectedTab(idx);
              }
            }
          } else if (tab && !tab.disabled) {
            const idx = this.tabsIdxHash[this.getNormalizedTabId(tab.id)];
            if (idx !== -1) {
              event.preventDefault();
              this.updateSelectedTab(idx);
            }
          }
          break;
        }
      }
    }

    private setupTabsEvents() {
      this.addEventListener("tab-click", this.handleTabClick as EventListener);
      this.addEventListener("tab-cross-click", this.handleTabCrossClick as EventListener);
      this.addEventListener("tab-close-click", this.handleTabCloseClick as EventListener);
      this.addEventListener("keydown", this.handleTabKeydown as EventListener);
      this.addEventListener("clear-tab-order-prefs", this.clearTabOrderPrefs as EventListener);
    }

    private teardownTabsEvents() {
      this.removeEventListener("tab-click", this.handleTabClick as EventListener);
      this.removeEventListener("tab-cross-click", this.handleTabCrossClick as EventListener);
      this.removeEventListener("tab-close-click", this.handleTabCloseClick as EventListener);
      this.removeEventListener("keydown", this.handleTabKeydown as EventListener);
      this.removeEventListener("clear-tab-order-prefs", this.clearTabOrderPrefs as EventListener);
    }

    private clearTabOrderPrefs(event: CustomEvent) {
      const { compUniqueId } = event.detail;
      if (compUniqueId === this.compUniqueId) {
        localStorage.removeItem(this.tabsId);
        sessionStorage.removeItem(this.tabsId);
        localStorage.removeItem(this.compUniqueId);
        this.tabsOrderPrefsArray = this.defaultTabsOrderArray;
        this.selected = 0;
        this.initializeTabs();
        this.dispatchSelectedChangedEvent(0);
      }
    }

    private setupPanelsAndTabs() {
      if (this.tabSlotElement) {
        this.tabs = this.tabSlotElement.assignedElements() as Tab.ELEMENT[];
      }
      if (this.panelSlotElement) {
        this.panels = this.panelSlotElement.assignedElements() as TabPanel.ELEMENT[];
      }

      this.defaultTabsOrderArray = this.tabs.map((tab) => tab.name);
    }

    private async setupMoreTab() {
      if (this.direction !== "vertical") {
        if (this.moreTabMenuElement && !this.isMoreTabMenuMeasured) {
          this.moreTabMenuElement.classList.add("md-menu-overlay__more_tab--measuring");
          await this.moreTabMenuElement.updateComplete;
          if (this.moreTabMenuElement.offsetWidth) {
            this.moreTabMenuOffsetWidth = this.moreTabMenuElement.offsetWidth;
            this.isMoreTabMenuMeasured = true;
          }
          this.moreTabMenuElement.classList.remove("md-menu-overlay__more_tab--measuring");
        }
      }
    }

    private initializeSortable() {
      if (this.visibleTabsContainerElement && this.hiddenTabsContainerElement) {
        this.visibleTabsSortableInstance = Sortable.create(this.visibleTabsContainerElement, this.generateOptions());
        this.hiddenTabsSortableInstance = Sortable.create(this.hiddenTabsContainerElement, this.generateOptions());
      }
    }

    private initializeTabs() {
      this.tabs = [];
      this.panels = [];
      this.tabsFilteredAsVisibleList = [];
      this.tabsFilteredAsHiddenList = [];
      this.isMoreTabMenuVisible = false;
      this.setupPanelsAndTabs();
      this.linkPanelsAndTabs();
      if (this.draggable) {
        this.initializeSortable();
      }
      this.manageOverflow();
      this.requestUpdate();
    }

    connectedCallback() {
      super.connectedCallback();
      this.setupTabsEvents();
      if (this.persistSelection) {
        if (!this.tabsId || this.tabsId.trim() === "") {
          console.error("Unique tabs-id attribute is mandatory for persist the selection of tab ");
          return;
        }
        const persistedSelectedTabIdx = localStorage.getItem(this.tabsId);
        this.selected =
          persistedSelectedTabIdx && parseInt(persistedSelectedTabIdx) > -1
            ? parseInt(persistedSelectedTabIdx)
            : this.selected;
      }

      this.compUniqueId && (this.tabsOrderPrefsArray = localStorage.getItem(this.compUniqueId)?.split(",") || []);
    }

    private selectTabFromStorage() {
      if (this.persistSelection) {
        if (!this.tabsId || this.tabsId.trim() === "") {
          console.error("Unique tabs-id attribute is mandatory for persist the selection of tab ");
          return;
        }
        const persistedSelectedTabIdx = sessionStorage.getItem(this.tabsId);
        let selectedTabIndex = 0;
        if (persistedSelectedTabIdx) {
          const idx = parseInt(persistedSelectedTabIdx);
          selectedTabIndex = idx > -1 ? idx : this.selected;
        }

        const currentTabsLayout = [...this.tabsFilteredAsVisibleList, ...this.tabsFilteredAsHiddenList];
        if (currentTabsLayout.length && currentTabsLayout[selectedTabIndex].id) {
          this.handleNewSelectedTab(currentTabsLayout[selectedTabIndex].id);
        } else {
          this.selected = selectedTabIndex;
        }
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this.teardownTabsEvents();
    }

    protected firstUpdated(changedProperties: PropertyValues) {
      super.firstUpdated(changedProperties);
      this.setupPanelsAndTabs();
      this.linkPanelsAndTabs();
      this.selectTabFromStorage();
    }

    protected updated(changedProperties: PropertyValues) {
      super.updated(changedProperties);

      if (changedProperties.has("slotted")) {
        this.initializeTabs();
      }

      if (this.draggable && !this.visibleTabsSortableInstance && !this.hiddenTabsSortableInstance) {
        this.initializeSortable();
      }

      if (changedProperties.has("tabsFilteredAsHiddenList")) {
        this.tabsCopy = Array.from(this.tabsCopyHiddenListElements?.values() || []);
        this.tabsCopyHash = this.tabsCopy.reduce(
          (acc, tab) => {
            acc[tab.id] = tab;
            return acc;
          },
          {} as Record<TabId, Tab.ELEMENT>
        );
      }

      if (changedProperties.has("tabsFilteredAsVisibleList") || changedProperties.has("tabsFilteredAsHiddenList")) {
        this.tabsVisibleIdxHash = this.tabsFilteredAsVisibleList.reduce(
          (acc, tab, idx) => {
            acc[tab.id] = idx;
            return acc;
          },
          {} as Record<TabId, number>
        );
        this.tabsHiddenIdxHash = this.tabsFilteredAsHiddenList.reduce(
          (acc, tab, idx) => {
            acc[tab.id] = idx;
            return acc;
          },
          {} as Record<TabId, number>
        );
      }

      if (changedProperties.has("isMoreTabMenuOpen")) {
        if (this.isMoreTabMenuVisible) {
          const oldValue = changedProperties.get("isMoreTabMenuOpen");
          if (this.isMoreTabMenuOpen && !oldValue) {
            // Add/Remove more overlay scroll
            if (this.moreItemsScrollLimit < this.tabsCopy.length) {
              this.isMoreTabMenuScrollable = true;
              this.moreTabMenuMaxHeight = `${this.measureHiddenTabsCopiesOffsetHeight()
                .slice(0, this.moreItemsScrollLimit)
                .reduce((acc, h) => {
                  acc += h;
                  return acc;
                }, 0)}px`;
            } else {
              this.isMoreTabMenuScrollable = false;
              this.moreTabMenuMaxHeight = null;
            }
          }
        }
      }

      if (changedProperties.has("tabsId")) {
        this.selectTabFromStorage();
      }
    }

    render() {
      return html`
        <div
          part="tabs-list"
          class="md-tab__list ${classMap({
            "md-tab__justified": this.justified && !this.isMoreTabMenuVisible,
            "no-tabs-visible": this.noTabsVisible,
            "vertical-tab-list": this.direction === "vertical",
            "tab-new-momentum": this.newMomentum
          })}"
          role="tablist"
        >
          <slot
            name="tab"
            class="${classMap({
              "visible-tabs-slot": this.direction === "horizontal"
            })}"
          ></slot>
          <div
            id="visible-tabs-list"
            class="visible-tabs-container ${classMap({
              "md-tab__justified": this.justified && !this.isMoreTabMenuVisible,
              "visible-new-tabs": this.newMomentum
            })}"
          >
            ${repeat(
              this.tabsFilteredAsVisibleList,
              () => nanoid(10),
              (tab) => html`
                <md-tab
                  .closable="${tab.closable}"
                  .disabled="${tab.disabled}"
                  .selected="${tab.selected}"
                  name="${tab.name}"
                  id="${this.getCopyTabId(tab)}"
                  aria-label=${tab.ariaLabel}
                  aria-controls="${this.getAriaControlId(tab)}"
                  .isCrossVisible=${true}
                  tabIndex="${this.getTabIndex(tab)}"
                  .newMomentum=${this.newMomentum}
                  type=${this.type}
                  .onlyIcon="${tab.onlyIcon}"
                >
                  ${unsafeHTML(tab.innerHTML)}
                </md-tab>
              `
            )}
          </div>

          <md-menu-overlay
            custom-width="${MORE_MENU_WIDTH}"
            max-height="${MORE_MENU_HEIGHT}"
            class="md-menu-overlay__more ${classMap({
              "md-menu-overlay__more--hidden": this.isMoreTabMenuMeasured && !this.isMoreTabMenuVisible
            })}"
            placement="bottom-end"
            @menu-overlay-open="${() => (this.isMoreTabMenuOpen = true)}"
            @menu-overlay-close="${() => (this.isMoreTabMenuOpen = false)}"
          >
            <md-tab
              slot="menu-trigger"
              id="${MORE_MENU_TAB_TRIGGER_ID}"
              aria-label="${this.overflowLabel}"
              aria-haspopup="true"
              tabindex="${this.isMoreTabMenuVisible ? 0 : -1}"
              .selected=${this.isMoreTabMenuVisible ? this.isMoreTabMenuSelected : false}
              class="md-menu-overlay__more_tab ${classMap({
                "md-menu-overlay__more_tab--hidden": !this.isMoreTabMenuVisible
              })}"
              ariaRole="button"
              .newMomentum=${this.newMomentum}
              type=${this.type}
            >
              <span class="md-menu-overlay__overflow-label">${this.overflowLabel}</span>
              <md-icon
                name="${!this.isMoreTabMenuOpen ? "arrow-down-bold" : "arrow-up-bold"}"
                iconSet="momentumDesign"
                size="16"
                class="more-icon"
              ></md-icon>
            </md-tab>
            <div
              id="tabs-more-list"
              part="tabs-more-list"
              class="md-tab__list md-menu-overlay__more_list"
              style="${styleMap(
                this.isMoreTabMenuScrollable && this.moreTabMenuMaxHeight
                  ? {
                      "overflow-y": "auto",
                      height: this.moreTabMenuMaxHeight,
                      "max-height": this.moreTabMenuMaxHeight
                    }
                  : {}
              )}"
            >
              ${repeat(
                this.tabsFilteredAsHiddenList,
                () => nanoid(10),
                (tab) => html`
                  <md-tab
                    slot="draggable-item"
                    .disabled="${tab.disabled}"
                    .selected="${tab.selected}"
                    name="${tab.name}"
                    id="${this.getCopyTabId(tab)}"
                    aria-label=${tab.ariaLabel}
                    aria-controls="${this.getAriaControlId(tab)}"
                    @click="${() => this.handleOverlayClose()}"
                    tabIndex="${this.tabHiddenIdPositiveTabIndex === tab.id ? 0 : -1}"
                    ariaRole="menuitem"
                    .newMomentum=${this.newMomentum}
                    type=${this.type}
                    .onlyIcon="${tab.onlyIcon}"
                  >
                    ${unsafeHTML(tab.innerHTML)}
                  </md-tab>
                `
              )}
            </div>
          </md-menu-overlay>
          <div class="md-tabs__settings" part="md-tabs__settings">
            <slot name="settings"></slot>
          </div>
        </div>
        <div
          part="tabs-content"
          class="md-tab__content ${classMap({
            "no-tabs-visible": this.noTabsVisible
          })}"
        >
          <slot name="panel"></slot>
        </div>
      `;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-tabs": Tabs.ELEMENT;
  }
}
