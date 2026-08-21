import { resolveBrandAssets } from '../../../js/brand-resolver-core.js';

/**
 * P1 小红书海报品牌合成演示入口
 *
 * AI原稿 -> Brand Resolver -> Composer输入
 */
export function buildP1BrandCompositionInput({ background = 'light', rawCreative }) {
  const brandContext = resolveBrandAssets({
    scene: 'p1_xiaohongshu_poster',
    background
  }, {
    assets: {
      wesmart: {
        level: 'culture',
        priority: 1,
        source: 'google_drive',
        editable: false,
        variants: {
          color: {
            drive_file_id: '13xoQ80wH0r2_Yr8mYkEtKMh6sHNKyEaZ'
          },
          white: {
            drive_file_id: '1yCfyQeZqjFD2t6_1ar7gEv2mrlEZkrXm'
          }
        }
      },
      tech_group: {
        level: 'department',
        priority: 2,
        source: 'google_drive',
        editable: false,
        variants: {
          color: {
            drive_file_id: '1a0iBqBJOwMySybv67hO0FEMb_7MOcrAb'
          },
          white: {
            drive_file_id: '10CyZfesXi8bc3AIJxJ4rzFMLzGdrVqif'
          }
        }
      }
    },
    rules: {
      p1_xiaohongshu_poster: {
        required: ['wesmart'],
        optional: ['tech_group'],
        placements: {
          wesmart: {
            x: 72,
            y: 64,
            position: 'top_left'
          },
          tech_group: {
            x: 72,
            y: 1516,
            position: 'bottom_center'
          }
        }
      }
    }
  });

  return {
    rawCreative,
    brandAssets: brandContext.selectedAssets,
    scene: 'p1_xiaohongshu_poster',
    readyForComposer: true
  };
}
