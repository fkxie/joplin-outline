import joplin from 'api';
import { ToolbarButtonLocation, ContentScriptType, MenuItemLocation } from 'api/types';
import { registerSettings, settingValue, pluginIconName } from './settings';
import markdownHeaders from './markdownHeaders';
import panelHtml from './panelHtml';

joplin.plugins.register({
  async onStart() {

    // 注册settings(各项属性)
    await registerSettings();

    // 注册CodeMirror插件(跳转行)
    await joplin.contentScripts.register(
      ContentScriptType.CodeMirrorPlugin,
      'codeMirrorScroller',
      './codeMirrorScroller.js',
    );

    // 等效于 const panels = joplin.views.panels;
    const { panels } = joplin.views;
    const view = await (panels as any).create('outline.panel');

    await panels.setHtml(view, 'Loading outline panel ...');
    await panels.addScript(view, './webview.js');
    await panels.addScript(view, './webview.css');
    // cp ../node_modules/katex/dist/katex.min.* ./katex/
    await panels.addScript(view, './katex/katex.min.css');
    await panels.addScript(view, './katex/katex.min.js');

    // Called when a message is sent from the webview (using postMessage).
    await panels.onMessage(view, async (message: any) => {
      if (message.name === 'scrollToHeader') {
        const editorCodeView = await joplin.settings.globalValue('editor.codeView');
        const noteVisiblePanes = await joplin.settings.globalValue('noteVisiblePanes');
        if (editorCodeView && noteVisiblePanes.includes('editor')) {
          // scroll in raw markdown editor
          // 通过editor.execCommand执行CodeMirror的scrollToLine方法
          await joplin.commands.execute('editor.execCommand', {
            name: 'scrollToLine',
            args: [message.lineno],
          });
        } else {
          // scroll in WYSIWYG editor or viewer
          // scrollToHash是Joplin的内置命令
          await joplin.commands.execute('scrollToHash', message.hash);
        }
      } else if (message.name === 'contextMenu') {
        const noteId = (await joplin.workspace.selectedNoteIds())[0];
        const noteTitle = (await joplin.data.get(['notes', noteId], { fields: ['title'] })).title;
        let innerLink:string;
        if (message.hash === '') {
          innerLink = `[${noteTitle}](:/${noteId})`;
        } else {
          // 跳到id为noteId的note的hash为message.hash的位置
          innerLink = `[${noteTitle}#${message.content}](:/${noteId}#${message.hash})`;
        }
        
        // 创建名为input的Element
        const input = document.createElement('input');
        // 设置input的value属性
        input.setAttribute('value', innerLink);
        // 将input添加到body中，只有当元素被插入到文档中时，才能对其执行select()和copy操作。
        document.body.appendChild(input);
        // 选中input的内容
        input.select();
        // 复制input的内容
        document.execCommand('copy');
        // 移除input
        document.body.removeChild(input);
      }
    });

    async function updateTocView() {
      const note = await joplin.workspace.selectedNote();

      // Settings
      // Gets a setting value (only applies to setting you registered from your plugin)
      const autoHide = await settingValue('autoHide');

      let headers;
      if (note) {
        headers = markdownHeaders(note.body);
      } else {
        headers = [];
      }
      if (headers.length === 0) {
        if (autoHide && await (panels as any).visible(view)) {
          await (panels as any).hide(view);
        }
      } else if (!await (panels as any).visible(view) && (await settingValue('isVisible'))) {
        (panels as any).show(view);
      }

      const htmlText = await panelHtml(headers);
      await panels.setHtml(view, htmlText);
    }

    await joplin.workspace.onNoteSelectionChange(() => {
      updateTocView();
    });
    await joplin.workspace.onNoteChange(() => {
      updateTocView();
    });
    await joplin.settings.onChange(() => {
      updateTocView();
    });

    await updateTocView();

    await joplin.commands.register({
      name: 'toggleOutline',
      label: 'Toggle outline',
      iconName: pluginIconName(),
      execute: async () => {
        const isVisible = !await settingValue('isVisible');
        await joplin.settings.setValue('isVisible', isVisible);

        const note = await joplin.workspace.selectedNote();
        const headers = markdownHeaders(note.body);
        if (headers.length !== 0 || await settingValue('autoHide') === false) {
          (panels as any).show(view, isVisible);
        }
      },
    });
    await joplin.views.toolbarButtons.create('toggleOutline', 'toggleOutline', ToolbarButtonLocation.NoteToolbar);
    await joplin.views.menus.create('outlineMenu', 'Outline', [
      {
        label: 'toggleOutline',
        commandName: 'toggleOutline',
      },
    ], MenuItemLocation.Tools);
    await joplin.views.menuItems.create('outlineMenuItem', 'toggleOutline', MenuItemLocation.EditorContextMenu);
  },
});
