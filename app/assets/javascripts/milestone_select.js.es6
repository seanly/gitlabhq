/* eslint-disable */
(function (global) {
  class MilestoneSelect {
    constructor(currentProject) {
      this.$el = {};
      this.config = {};
      this.state = {};
      this.templates = {};

      this.storeElements();
      this.storeConfig();
      this.initState(currentProject);
      this.initTemplates();
      this.initDropdown();
    }

    storeElements() {
      const $document = $(document);
      const $body = $document.find('body');
      const $dropdown = $('.js-milestone-select');
      const $selectbox = $dropdown.closest('.selectbox');
      const $block = $selectbox.closest('.block');
      const $value = $block.find('.value');
      const $loading = $block.find('.block-loading');
      const $collapsedValue = $block.find('.sidebar-collapsed-icon');
      const $form = $dropdown.closest('form');

      _.extend(this.$el, {
        body: $body,
        document: $document,
        dropdown: $dropdown,
        dropdownSelectBox: $selectbox,
        containerBlock: $block,
        valueDisplay: $value,
        loadingDisplay: $loading,
        collapsedValue: $collapsedValue,
        form: $form
      });
    }

    storeConfig() {
      const $dropdown = this.$el.dropdown;
      const currentPage = this.$el.body.data('page');

      const isIssue = currentPage === 'projects:issues:index';
      const isMergeRequest = currentPage === 'projects:merge_requests:index';

      this.config.context = {
        isIssue,
        isMergeRequest,
        isBoardSidebar:  $dropdown.hasClass('js-issue-board-sidebar'),
        isSubmittableNonIndex: $dropdown.hasClass('js-filter-submit'),
        isSubmittableIndex: $dropdown.hasClass('js-filter-submit') && (isIssue || isMergeRequest),
        isBoard:  $('html').hasClass('issue-boards-page') && !$dropdown.hasClass('js-issue-board-sidebar'),
        shouldPreventSubmission:  $dropdown.hasClass('js-filter-bulk-update') || $dropdown.hasClass('js-issuable-form-dropdown'),
      };

      const dataset = this.config.dataset = this.$el.dropdown.get(0).dataset;

      this.config.display = {
        showMenuAbove: dataset.showMenuAbove,
        showNo: dataset.showNo,
        showAny: dataset.showAny,
        showUpcoming: dataset.showUpcoming,
        extraOptions: []
      };
    }

    initState(currentProject) {
      this.state.currentProject = currentProject ? JSON.parse(currentProject) : null;
      this.state.selectedMilestone = this.config.dataset.selected;
    }

    initTemplates() {
      if (this.config.dataset.issueUpdate) {
        this.templates = {
          milestoneLink: _.template(`
            <a href='/<%- namespace %>/ <%- path %>/milestones/<%- iid %>' class='bold has-tooltip'
              data-container='body' title='<%- remaining %>'><%- title %>
            </a>
          `),
          milestoneLinkNone: `<span class='no-value'>None</span>`,
          collapsedSidebarLabel: _.template(`
            <span class='has-tooltip' data-container='body' title='<%- remaining %>'
              data-placement='left'> <%- title %>
            </span>`
          ),
        };
      }
    }

    initDropdown() {
      const dataset = this.config.dataset;
      const selectedMilestone = dataset.selected;
      const searchFields = { fields: ['title'] };
      const isSelected = milestone => milestone.name === selectedMilestone;

      this.$el.dropdown.glDropdown({
        isSelected,
        filterable: true,
        selectable: true,
        search: searchFields,
        defaultLabel: dataset.defaultLabel,
        fieldName: dataset.fieldName,
        vue: this.config.context.isBoardSidebar,
        showMenuAbove: this.config.display.showMenuAbove,
        id: milestone => this.filterSelected(milestone),
        data: (term, callback) => this.fetchMilestones(term, callback),
        text: this.escapeText,
        hidden: () => this.renderDisplayState(),
        toggleLabel: (selected, $el, e) => this.toggleLabel(selected, $el, e),
        clicked: (selected, $el, e) => this.handleDropdownClick(selected, $el, e),
      });

      this.renderLoadedState();
    }

    renderDisplayState() {
      this.$el.dropdownSelectBox.hide();
      // display:block overrides the hide-collapse rule
      this.$el.valueDisplay.css('display', '');

    }

    escapeText(milestone) {
      return _.escape(milestone.title);
    }

    filterSelected(milestone) {
      const useId = this.config.dataset.useId;
      return (!useId && !this.$el.dropdown.is('.js-issuable-form-dropdown')) ? milestone.name : milestone.id;
    }

    fetchMilestones(term, callback) {
      const milestonesUrl = this.config.dataset.milestones;
      return $.ajax({ url: milestonesUrl })
        .done((data) => {
          this.prepExtraOptions();
          callback(this.config.display.extraOptions.concat(data));
          this.positionMenuAbove();
        });
    }

    toggleLabel(selected, $el, e) {
      const defaultLabel = this.config.dataset.defaultLabel;

      return (selected, el, e) => (selected && selected.id && el.hasClass('is-active')) ?
        selected.title : defaultLabel;
    }

    positionMenuAbove() {
      if (this.config.display.showMenuAbove) {
        this.$el.dropdown.positionMenuAbove();
      }
    }

    prepExtraOptions() {
      const displayConfig = this.config.display;
      if (displayConfig.showAny) this.storeExtraDropdownOptions(0, '', 'Any Milestone');
      if (displayConfig.showNo) this.storeExtraDropdownOptions(-1, 'No Milestone', 'No Milestone');
      if (displayConfig.showUpcoming) this.storeExtraDropdownOptions(-2, '#upcoming', 'Upcoming');
      if (displayConfig.extraOptions.length) this.storeExtraDropdownOptions('divider');
    }

    storeExtraDropdownOptions(id, name, title) {
      const divider = 'divider';
      const pushable = id === divider ? divider : { id, name, title };
      this.config.display.extraOptions.push(pushable);
    }

    renderLoadingState() {
      this.$el.loadingDisplay.fadeIn();
      this.$el.dropdown.trigger('loading.gl.dropdown');
    }

    renderLoadedState() {
      this.$el.loadingDisplay.fadeOut();
      this.$el.dropdown.trigger('loaded.gl.dropdown');
    }

    handleDropdownClick(selected, $el, e) {
      const pageConfig = this.config.context;

      if (pageConfig.shouldPreventSubmission) {
        return e.preventDefault();
      }

      if (pageConfig.isBoardPage) {
        return this.putIssueBoardPage(selected, $el, e);
      }

      if (pageConfig.isSubmittableIndex) {
        return this.putSubmittableIndex(selected, $el, e);
      }

      if (pageConfig.isSubmittableNonIndex) {
        return this.putSubmittableNonIndex(selected, $el, e);
      }

      if (pageConfig.isBoardSidebar) {
        return this.putIssueBoardSidebar(selected, $el, e);
      }

      return this.putGeneric(selected, $el, e);
    }

    putGeneric(selected, $el, e) {
      const selectedMilestone = this.$el.dropdownSelectBox.find('input[type="hidden"]').val() || selected.id;
      const milestonePayload = {};
      const abilityName = this.config.dataset.abilityName;

      milestonePayload[abilityName] = {};
      milestonePayload[abilityName].milestone_id = selectedMilestone;

      const issueUpdateURL = this.config.dataset.issueUpdate;
      // Swap out for vue resource.
      this.renderLoadingState();
      $.ajax({ type: 'PUT', url: issueUpdateURL, data: milestonePayload })
        .done(issuableData => {
          this.handlePutSuccess(issuableData);
        });
    }

    putIssueBoardPage(selected, $el, e) {
      gl.issueBoards.BoardsStore.state.filters[this.config.dataset.fieldName] = selected.name;
      gl.issueBoards.BoardsStore.updateFiltersUrl();
      e.preventDefault();
    }

    putIssueBoardSidebar(selected, $el, e) {
      if (selected.id !== -1) {
        Vue.set(gl.issueBoards.BoardsStore.detail.issue, 'milestone', new ListMilestone({
          id: selected.id,
          title: selected.name
        }));
      } else {
        Vue.delete(gl.issueBoards.BoardsStore.detail.issue, 'milestone');
      }

      this.renderLoadingState();

      gl.issueBoards.BoardsStore.detail.issue.update(this.config.dataset.issueUpdate)
        .then(() =>  this.renderLoadedState());
    }

    putSubmittableIndex(selected, $el, e) {
      return Issuable.filterResults(this.$el.form);
    }

    putSubmittableNonIndex(selected, $el, e) {
      return this.$el.form.submit();
    }

    handlePutSuccess(issuableData) {
      this.renderLoadedState();

      issuableData.milestone = this.parsePutValue(issuableData);
      this.renderUpdatedState(issuableData);
    }

    parsePutValue(data) {
      const milestoneData = data.milestone;
      if (milestoneData != null) {
        const currentProject = this.state.currentProject;
        milestoneData.namespace = currentProject.namespace;
        milestoneData.path = currentProject.path;
        milestoneData.remaining = gl.utils.timeFor(milestoneData.due_date);
      }
      return milestoneData;
    }

    renderUpdatedState(issuableData) {
      const $valueDisplay = this.$el.valueDisplay;
      const $collapsedValue = this.$el.collapsedValue;
      const milestoneData = issuableData.milestone;

      if (milestoneData != null) {
        $valueDisplay.html(this.templates.milestoneLink(milestoneData));
        $collapsedValue.find('span').html(this.templates.collapsedSidebarLabel(milestoneData));
       } else {
        $valueDisplay.html(this.templates.milestoneLinkNone);
        $collapsedValue.find('span').text('No');
      }
    }

    updateState(issuableData) {
      this.renderUpdatedState(issuableData);
    }
  }
  global.MilestoneSelect = MilestoneSelect;
})(window);

