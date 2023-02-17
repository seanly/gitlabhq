# frozen_string_literal: true

module Sidebars
  class Panel
    extend ::Gitlab::Utils::Override
    include ::Sidebars::Concerns::PositionableList
    include Gitlab::Experiment::Dsl

    attr_reader :context, :scope_menu, :hidden_menu

    def initialize(context)
      @context = context
      @scope_menu = nil
      @hidden_menu = nil
      @menus = []

      configure_menus
    end

    def configure_menus
      # No-op
    end

    def add_menu(menu)
      add_element(@menus, menu)
    end

    def insert_menu_before(before_menu, new_menu)
      insert_element_before(@menus, before_menu, new_menu)
    end

    def insert_menu_after(after_menu, new_menu)
      insert_element_after(@menus, after_menu, new_menu)
    end

    def replace_menu(menu_to_replace, new_menu)
      replace_element(@menus, menu_to_replace, new_menu)
    end

    def remove_menu(menu_to_remove)
      remove_element(@menus, menu_to_remove)
    end

    def set_scope_menu(scope_menu)
      @scope_menu = scope_menu
    end

    def set_hidden_menu(hidden_menu)
      @hidden_menu = hidden_menu
    end

    def aria_label
      raise NotImplementedError
    end

    def has_renderable_menus?
      renderable_menus.any?
    end

    def renderable_menus
      @renderable_menus ||= @menus.select(&:render?)
    end

    # Serializes every renderable sub-menu and menu-item for the super sidebar
    # A flattened list of menu items is grouped into the appropriate parent
    def super_sidebar_menu_items
      @super_sidebar_menu_items ||= renderable_menus
        .flat_map(&:serialize_for_super_sidebar)
        .each_with_object([]) do |item, acc|
        # Finding the parent of an entry
        parent_id = item.delete(:parent_id)
        parent_idx = acc.find_index { |i| i[:id] == parent_id }

        # Entries without a matching parent entry are top level
        if parent_idx.nil?
          acc.push(item)
        else
          acc[parent_idx][:items] ||= []
          acc[parent_idx][:items].push(item)
          # If any sub-item of a navigation item is active, its parent should be as well
          acc[parent_idx][:is_active] ||= item[:is_active]
        end
      end
    end

    def super_sidebar_context_header
      raise NotImplementedError
    end

    def container
      context.container
    end

    # Auxiliar method that helps with the migration from
    # regular views to the new logic
    def render_raw_scope_menu_partial
      # No-op
    end

    # Auxiliar method that helps with the migration from
    # regular views to the new logic.
    #
    # Any menu inside this partial will be added after
    # all the menus added in the `configure_menus`
    # method.
    def render_raw_menus_partial
      # No-op
    end

    private

    override :index_of
    def index_of(list, element)
      list.index { |e| e.is_a?(element) }
    end
  end
end
