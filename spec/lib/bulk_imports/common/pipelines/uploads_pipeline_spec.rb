# frozen_string_literal: true

require 'spec_helper'

RSpec.describe BulkImports::Common::Pipelines::UploadsPipeline do
  let_it_be(:tmpdir) { Dir.mktmpdir }
  let_it_be(:project) { create(:project) }
  let_it_be(:group) { create(:group) }

  let(:uploads_dir_path) { File.join(tmpdir, '72a497a02fe3ee09edae2ed06d390038') }
  let(:upload_file_path) { File.join(uploads_dir_path, 'upload.txt')}
  let(:tracker) { create(:bulk_import_tracker, entity: entity) }
  let(:context) { BulkImports::Pipeline::Context.new(tracker) }

  subject(:pipeline) { described_class.new(context) }

  before do
    stub_uploads_object_storage(FileUploader)

    FileUtils.mkdir_p(uploads_dir_path)
    FileUtils.touch(upload_file_path)
  end

  after do
    FileUtils.remove_entry(tmpdir) if Dir.exist?(tmpdir)
  end

  shared_examples 'uploads import' do
    describe '#run' do
      before do
        allow(Dir).to receive(:mktmpdir).with('bulk_imports').and_return(tmpdir)
        allow(pipeline).to receive(:extract).and_return(BulkImports::Pipeline::ExtractedData.new(data: [upload_file_path]))
      end

      it 'imports uploads into destination portable and removes tmpdir' do
        pipeline.run

        expect(portable.uploads.map { |u| u.retrieve_uploader.filename }).to include('upload.txt')

        expect(Dir.exist?(tmpdir)).to eq(false)
      end

      context 'when importing avatar' do
        let(:uploads_dir_path) { File.join(tmpdir, 'avatar') }

        it 'imports avatar' do
          FileUtils.touch(File.join(uploads_dir_path, 'avatar.png'))

          expect_next_instance_of(entity.update_service) do |service|
            expect(service).to receive(:execute)
          end

          pipeline.run
        end

        context 'when something goes wrong' do
          it 'raises exception' do
            allow_next_instance_of(entity.update_service) do |service|
              allow(service).to receive(:execute).and_return(nil)
            end

            pipeline.run

            expect(entity.failures.first.exception_class).to include('AvatarLoadingError')
          end
        end
      end
    end

    describe '#extract' do
      it 'downloads & extracts upload paths' do
        allow(Dir).to receive(:mktmpdir).and_return(tmpdir)
        expect(pipeline).to receive(:untar_zxf)
        file_download_service = instance_double("BulkImports::FileDownloadService")

        expect(BulkImports::FileDownloadService)
          .to receive(:new)
          .with(
            configuration: context.configuration,
            relative_url: "/#{entity.pluralized_name}/test/export_relations/download?relation=uploads",
            dir: tmpdir,
            filename: 'uploads.tar.gz')
          .and_return(file_download_service)

        expect(file_download_service).to receive(:execute)

        extracted_data = pipeline.extract(context)

        expect(extracted_data.data).to contain_exactly(uploads_dir_path, upload_file_path)
      end
    end

    describe '#load' do
      it 'creates a file upload' do
        expect { pipeline.load(context, upload_file_path) }.to change { portable.uploads.count }.by(1)
      end

      context 'when dynamic path is nil' do
        it 'returns' do
          expect { pipeline.load(context, File.join(tmpdir, 'test')) }.not_to change { portable.uploads.count }
        end
      end

      context 'when path is a directory' do
        it 'returns' do
          expect { pipeline.load(context, uploads_dir_path) }.not_to change { portable.uploads.count }
        end
      end
    end
  end

  context 'when importing to group' do
    let(:portable) { group }
    let(:entity) { create(:bulk_import_entity, :group_entity, group: group, source_full_path: 'test') }

    include_examples 'uploads import'
  end

  context 'when importing to project' do
    let(:portable) { project }
    let(:entity) { create(:bulk_import_entity, :project_entity, project: project, source_full_path: 'test') }

    include_examples 'uploads import'
  end
end
